import { BadRequestException, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { LoginUser } from "../auth/dto/login-user.dto";
import { AddContactsToOptOutDto, GetOptOutContactsDto, RemoveContactsFromOptOutDto } from "./dto/create-opt-out";
import { returnSuccess } from "@/common/helpers/response-handler.helper";
import { ApiServiceResponse } from "@/common/type/api-service.type";
import { ContactStatus, Prisma, QueueStatus } from "@prisma/client";
import { SearchUtils } from "@/utils/search.utils";
import type { OptOutContactDTO } from "./dto/optout.contact.dto";
import { isPhoneLike } from "@/utils/phone-numbers/format-phone-number";
import { BasicUser } from '../user/dto/user.dto';

@Injectable()
export class OptOutService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ) { }

    // create opt-out service 
    async addContactsToOptOut(
        user: LoginUser,
        dto: AddContactsToOptOutDto
    ): Promise<ApiServiceResponse> {
        const { contactIds, reason } = dto;

        if (!contactIds?.length) {
            throw new BadRequestException('At least one contactId or phone number is required');
        }


        const userId = user.parentUserId ?? user.id;
        const agencyId = user.agencyId;

        // Split input into "ID-based" and "Phone-based"
        const idList: bigint[] = [];
        const phoneList: string[] = [];

        for (const val of contactIds) {
            const strVal = String(val).trim();

            // Detect phone number pattern: starts with '+' and >= 10 digits
            if (isPhoneLike(strVal)) {
                phoneList.push(strVal);
            } else {
                try {
                    idList.push(BigInt(strVal));
                } catch {
                    throw new BadRequestException(`Invalid contact identifier: ${val}`);
                }
            }
        }

        // --- Find valid contacts ---
        const existingContacts = await this.prisma.contact.findMany({
            where: {
                OR: [
                    idList.length
                        ? {
                            id: { in: idList },
                            userId,
                            agencyId,
                        }
                        : undefined,
                    phoneList.length
                        ? {
                            number: { in: phoneList },
                            userId,
                            agencyId,
                        }
                        : undefined,
                ].filter(Boolean) as any,
            },
            select: { id: true, number: true },
        });

        if (!existingContacts.length) {
            throw new BadRequestException('No valid contacts found for given IDs or phone numbers');
        }

        const validContactIds = existingContacts.map((c) => c.id);

        // --- Check for existing opt-outs ---
        const existingOptOuts = await this.prisma.optOutContact.findMany({
            where: {
                contactId: { in: validContactIds },
                userId,
                agencyId,
            },
            select: { contactId: true },
        });


        const alreadyOpted = new Set(existingOptOuts.map((o) => o.contactId.toString()));
        const newOptOutIds = validContactIds.filter((id) => !alreadyOpted.has(id.toString()));

        if (!newOptOutIds.length) {
            // throw new BadRequestException('All provided contacts are already opted out');
            return returnSuccess(200, 'All provided contacts are already opted out');
        }

        // --- Prepare and insert ---
        const optOutData = newOptOutIds.map((contactId) => ({
            userId,
            agencyId,
            contactId,
            reason,
        }));

        const contactIdsBigInt = newOptOutIds.map((id) => BigInt(id));

        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.optOutContact.createMany({
                    data: optOutData,
                    skipDuplicates: true,
                }),
                    // Step 2: Update contact status to OPT_OUT
                    await tx.contact.updateMany({
                        where: {
                            agencyId,
                            userId,
                            id: { in: contactIdsBigInt },
                            status: { not: ContactStatus.OPT_OUT }, // Skip already opted-out for efficiency
                        },
                        data: {
                            status: ContactStatus.OPT_OUT,
                        },
                    });


                // Step 3: Remove from broadcastContact
                await tx.broadcastContact.deleteMany({
                    where: {
                        agencyId,
                        userId,
                        contactId: { in: contactIdsBigInt },
                    },
                });

                // Step 4: Delete pending broadcastMessageQueue
                await tx.broadcastMessageQueue.deleteMany({
                    where: {
                        agencyId,
                        userId,
                        contactId: { in: contactIdsBigInt },
                        status: QueueStatus.PENDING,
                    },
                });
            });

            return returnSuccess(200, 'Contacts opted out successfully');
        } catch (error) {
            this.logger.error(`Failed to create opt-outs: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to process opt-out request');
        }
    }


    // remove contacts from opt-out
    async removeContactsFromOptOut(user: LoginUser, dto: RemoveContactsFromOptOutDto): Promise<ApiServiceResponse> {
        const { id: userId, agencyId } = user;
        const { contactIds } = dto;

        // Validate inputs
        if (!contactIds?.length) {
            throw new BadRequestException('At least one contactId is required');
        }

        // Check for existing contacts and their validity
        const existingContacts = await this.prisma.contact.findMany({
            where: {
                id: { in: contactIds.map(id => BigInt(id)) },
                userId,
                agencyId, // Ensure contacts belong to user's agency
            },
            select: { id: true },
        });

        const existingContactIds = new Set(existingContacts.map(c => c.id));
        const invalidContactIds = contactIds.filter(id => !existingContactIds.has(BigInt(id)));
        if (invalidContactIds.length) {
            throw new BadRequestException(`Invalid contactIds: ${invalidContactIds.join(', ')}`);
        }

        // Check for existing opt-outs to avoid duplicates
        const existingOptOuts = await this.prisma.optOutContact.findMany({
            where: { contactId: { in: contactIds.map(id => BigInt(id)) }, userId, agencyId },
            select: { contactId: true },
        });

        const existingOptOutIds = new Set(existingOptOuts.map(o => o.contactId));
        const validOptOutIds = contactIds.filter(id => existingOptOutIds.has(BigInt(id)));

        if (!validOptOutIds.length) {
            throw new BadRequestException('All provided contactIds are not opted out');
        }

        // Use transaction for atomicity
        try {
            await this.prisma.$transaction([
                this.prisma.optOutContact.deleteMany({
                    where: { contactId: { in: validOptOutIds.map(id => BigInt(id)) }, userId, agencyId },
                }),

                //update contact status to ACTIVE
                this.prisma.contact.updateMany({
                    where: { id: { in: validOptOutIds.map(id => BigInt(id)) }, userId, agencyId },
                    data: { status: ContactStatus.ACTIVE },
                })
            ]);

            return returnSuccess(200, 'Opt-outs deleted successfully');
        } catch (error) {
            this.logger.error(`Failed to delete opt-outs: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to process opt-out request');
        }


    }

    // list all opted out contacts
    async getAllOptOutContacts(user: LoginUser, dto: GetOptOutContactsDto): Promise<{
        contacts: { id: bigint, firstName: string | null; lastName: string | null; number: string | null; email: string | null }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        message?: string;
    }> {
        const { id: userId, agencyId } = user;
        const {
            page = 1,
            limit = 10,
            firstName,
            lastName,
            number,
            email,
            sortBy = 'firstName',
            sortOrder = 'desc',
        } = dto;

        // Step 1: Get contactIds from optOutContact table
        const optOutContacts = await this.prisma.optOutContact.findMany({
            where: { userId, agencyId },
            select: { contactId: true },
        });
        const optOutContactIds: bigint[] = optOutContacts.map(o => BigInt(o.contactId)); // Explicitly cast to bigint

        // Step 2: Validate pagination parameters
        const parsedPage = Math.max(1, Number(page));
        const parsedLimit = Math.min(Math.max(1, Number(limit)), 100); // Cap limit to avoid performance issues

        // Step 3: Validate sorting parameters
        const validSortFields = ['firstName', 'lastName'];
        const validSortOrders = ['asc', 'desc'];
        const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'firstName';
        const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

        // Step 4: Build the base where clause
        const baseWhere: Prisma.ContactWhereInput = {
            userId,
            agencyId,
            id: { in: optOutContactIds }, // Now typed as bigint[]
        };

        // Step 5: Apply search filters
        const searchTerms: string[] = [];
        const searchFields: (keyof Prisma.ContactWhereInput)[] = [];
        if (number?.trim()) {
            searchTerms.push(number.trim());
            searchFields.push('number');
        }
        if (email?.trim()) {
            searchTerms.push(email.trim());
            searchFields.push('email');
        }
        if (firstName?.trim()) {
            searchTerms.push(firstName.trim());
            searchFields.push('firstName');
        }
        if (lastName?.trim()) {
            searchTerms.push(lastName.trim());
            searchFields.push('lastName');
        }

        // Step 6: Build the search query
        let where = baseWhere;
        if (searchTerms.length > 0) {
            const searchString = searchTerms.join(' ');
            where = SearchUtils.applySearch<Prisma.ContactWhereInput>(
                baseWhere,
                searchString,
                {
                    fields: searchFields,
                    strategy: 'ALL',
                    minTermLength: 1,
                    maxTerms: 10,
                    caseSensitive: false,
                }
            );
        }

        // Step 7: Fetch contacts and total count
        try {
            const [contacts, total] = await Promise.all([
                this.prisma.contact.findMany({
                    where,
                    take: parsedLimit,
                    skip: (parsedPage - 1) * parsedLimit,
                    orderBy: { [finalSortBy]: finalSortOrder },
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        number: true,
                        email: true,
                    },
                }),
                this.prisma.contact.count({ where }),
            ]);

            return {
                contacts,
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit),
                message: contacts.length === 0 ? 'No opt-out contacts found for the given criteria.' : undefined,
            };
        } catch (error) {
            // Handle Prisma-specific errors
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                this.logger.error(`Prisma error: ${error.message}`, error.stack);
                return {
                    contacts: [],
                    total: 0,
                    page: parsedPage,
                    limit: parsedLimit,
                    totalPages: 0,
                    message: `Invalid query parameters: ${error.message}`,
                };
            }
            // Handle unexpected errors
            this.logger.error(`Failed to fetch opt-out contacts: ${error.message}`, error.stack);
            return {
                contacts: [],
                total: 0,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: 0,
                message: 'An unexpected error occurred while fetching opt-out contacts.',
            };
        }
    }


    async optOutContact(user: BasicUser, optOutContact: OptOutContactDTO): Promise<bigint> {
        try {
            const inserted = await this.prisma.optOutContact.create({
                data: {
                    userId: user.parentUserId ? user.parentUserId : user.id,
                    createdBy: user.id,
                    agencyId: optOutContact.agencyId,
                    contactId: optOutContact.contactId,
                    reason: optOutContact.reason || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                select: {
                    id: true,
                }
            });
            return inserted.id;
        } catch (error) {
            this.logger.error(error);
        }
    }

    async addOptOutContact(user: LoginUser, optOutContact: OptOutContactDTO): Promise<bigint> {
        try {
            const inserted = await this.prisma.optOutContact.create({
                data: {
                    userId: user.parentUserId ? user.parentUserId : user.id,
                    createdBy: user.id,
                    agencyId: optOutContact.agencyId,
                    contactId: optOutContact.contactId,
                    reason: optOutContact.reason || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                select: {
                    id: true,
                }
            });
            return inserted.id;
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * 
     * @param userId 
     * @param contactId 
     * @returns 
     */
    async isContactOptedOut(userId: bigint, contactId: bigint): Promise<boolean> {
        if (!userId || !contactId) return false;
        try {
            const optOut = await this.prisma.optOutContact.findFirst({
                where: {
                    userId,
                    contactId
                }, select: {
                    id: true
                }
            });
            return !!optOut;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

}