import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { AssignSegmentToMemberDto, CreateSegmentDto, Filters, GetContactsBySegmentIdDto, GetSegmentsDto, UpdateSegmentDto, SegmentListParamDto, SegmentListItemDto } from './dto/create-segment.dto';
import { ContactStatus, Prisma } from "@prisma/client";
import { LoginUser } from '../auth/dto/login-user.dto';
import { ApiListResponseDto, PaginationMetaDto } from '../../common/dto/api-list-response.dto';

@Injectable()
export class SegmentService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ) { }


    async getSegment(
        user: LoginUser,
        query: SegmentListParamDto,
    ): Promise<ApiListResponseDto<SegmentListItemDto>> {
        try {
            const {
                page = 1,
                perPage = 10,
                sortOn = 'createdAt',
                sortDirection = 'desc',
                query: q,
                needPagination = false,
            } = query ?? {};

            const qTrim = (q ?? '').toString().trim();

            // 🔐 Tenant scope
            const where: Prisma.SegmentWhereInput = {
                agencyId: BigInt(user.agencyId),
                userId: user.parentUserId ? BigInt(user.parentUserId) : BigInt(user.id),
                ...(qTrim ? { name: { contains: qTrim } } : {}),
            };

            //  allow-list sort fields
            const allowedSortFields = new Set<keyof Prisma.SegmentOrderByWithRelationInput>([
                'id',
                'name',
                'createdAt',
                'updatedAt',
            ]);
            const sortField = allowedSortFields.has(sortOn as any) ? (sortOn as any) : ('id' as const);
            const orderBy: Prisma.SegmentOrderByWithRelationInput = {
                [sortField]: sortDirection === 'asc' ? 'asc' : 'desc',
            };

            const baseFindArgs: Prisma.SegmentFindManyArgs = {
                where,
                select: { id: true, name: true },
                orderBy,
            };

            if (needPagination) {
                const safePerPage = Math.max(1, Math.min(100, Number(perPage)));
                const safePage = Math.max(1, Number(page));
                const skip = (safePage - 1) * safePerPage;

                const [rows, total] = await this.prisma.$transaction([
                    this.prisma.segment.findMany({ ...baseFindArgs, skip, take: safePerPage }),
                    this.prisma.segment.count({ where }),
                ]);

                const data: SegmentListItemDto[] = rows.map((r) => ({
                    id: Number(r.id),
                    name: r.name,
                }));

                const totalPages = Math.max(1, Math.ceil(total / safePerPage));
                const pagination: PaginationMetaDto = {
                    total,
                    perPage: safePerPage,
                    currentPage: safePage,
                    totalPages,
                    nextPage: safePage < totalPages ? safePage + 1 : undefined,
                    prevPage: safePage > 1 ? safePage - 1 : undefined,
                };

                return {
                    statusCode: 200,
                    message: 'Segments retrieved successfully.',
                    data,
                    pagination,
                };
            }

            // No pagination requested
            const rows = await this.prisma.segment.findMany(baseFindArgs);
            const data: SegmentListItemDto[] = rows.map((r) => ({
                id: Number(r.id),
                name: r.name,
            }));

            return {
                statusCode: 200,
                message: 'Segments retrieved successfully.',
                data,
            };
        } catch (err) {
            // swap with this.logger.error(err) if you have a logger
            console.error('getSegment error:', err);
            return {
                statusCode: 500,
                message: 'An error occurred while fetching segments.',
                data: [],
            };
        }
    }

    async createSegment(user: LoginUser, dto: CreateSegmentDto) {
        try {
            // console.log(`Received DTO:`, dto); // Debug log

            // Validate name
            if (!dto.name || typeof dto.name !== 'string' || dto.name.trim() === '') {
                throw new BadRequestException('Segment name is required and must be a non-empty string');
            }

            // Default to empty filters if undefined
            const filters: Filters = dto.filters || {};

            // Extract contactIds and other filters, provide default empty values
            const { contactIds = [], ...otherFilters } = filters;

            // Create the segment without contactIds in filters
            const segment = await this.prisma.segment.create({
                data: {
                    userId: user.parentUserId ? BigInt(user.parentUserId) : BigInt(user.id),
                    agencyId: BigInt(user.agencyId),
                    createdBy: BigInt(user.id),
                    name: dto.name,
                    filters: otherFilters, // Store status, tags, dateRange, searchQuery
                },
            });

            // If contactIds are provided, create SegmentContact entries
            if (contactIds.length > 0) {
                const segmentContactData = contactIds.map((contactId) => ({
                    userId: segment.userId,
                    createdBy: segment.createdBy,
                    agencyId: segment.agencyId,
                    segmentId: segment.id,
                    contactId: BigInt(contactId),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }));

                await this.prisma.segmentContact.createMany({
                    data: segmentContactData,
                    skipDuplicates: true, // Respect the unique constraint on segmentId, contactId
                });
            }

            return segment;
        } catch (error) {
            this.logger.error(`Failed to create segment: ${error.message}`);
            throw new BadRequestException(error.message || `Failed to create segment: ${error.message}`);
        }
    }

    // update segment
    async updateSegment(userId: bigint, agencyId: bigint, segmentId: number, dto: UpdateSegmentDto) {
        // console.log("dto on service of updateSegment", dto);
        try {

            // Default to empty filters if undefined
            const filters: Filters = dto.filters || {};

            // Extract contactIds and other filters, provide default empty values
            const { contactIds = [], ...otherFilters } = filters;

            // Update the segment without contactIds in filters
            const segment = await this.prisma.segment.update({
                where: { id: segmentId },
                data: {
                    name: dto.name,
                    filters: otherFilters, // Store status, tags, dateRange, searchQuery
                },
            });

            // If contactIds are provided, create SegmentContact entries
            if (contactIds.length > 0) {
                const segmentContactData = contactIds.map((contactId) => ({
                    userId: segment.userId,
                    createdBy: segment.createdBy,
                    agencyId: segment.agencyId,
                    segmentId: segment.id,
                    contactId: BigInt(contactId),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }));

                await this.prisma.segmentContact.createMany({
                    data: segmentContactData,
                    skipDuplicates: true, // Respect the unique constraint on segmentId, contactId
                });
            }

            return segment;
        } catch (error) {
            this.logger.error(`Failed to update segment: ${error.message}`);
            throw new BadRequestException(error.message || `Failed to update segment: ${error.message}`);
        }
    }

    // get segments for a user
    async getSegments(userId: bigint, agencyId: bigint, dto: GetSegmentsDto) {
        const { page, limit, name, status, sortBy = 'createdAt', sortOrder = 'desc' } = dto;

        // console.log("dto on service of getSegments", dto);

        // Validate pagination parameters
        const parsedPage = Math.max(1, Number(page));
        const parsedLimit = Math.min(Math.max(1, Number(limit)), 100); // Cap limit to avoid performance issues

        // Define allowed sort fields and order
        const validSortFields = ['name', 'createdAt', 'updatedAt'];
        const validSortOrders = ['asc', 'desc'];
        const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

        // Build the where clause
        const where: Prisma.SegmentWhereInput = {
            userId: BigInt(userId),
            agencyId: BigInt(agencyId),
        };

        // Build OR conditions for search filters
        const orConditions: Prisma.SegmentWhereInput[] = [];

        if (name?.trim()) {
            orConditions.push({ name: { contains: name.trim() } });
        }

        if (status?.trim()) {
            orConditions.push({ filters: { path: 'status', array_contains: [status.trim()] } });
        }

        if (orConditions.length > 0) {
            where.OR = orConditions;
        }

        // Validate status if provided
        const validStatuses = ['ACTIVE', 'INACTIVE', 'DELETED'];
        if (status && !validStatuses.includes(status.toUpperCase())) {
            return {
                segments: [],
                total: 0,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: 0,
                message: `Invalid status value: ${status}. Expected one of ${validStatuses.join(', ')}.`,
            };
        }

        try {
            const [segments, total] = await Promise.all([
                this.prisma.segment.findMany({
                    where,
                    include: {
                        segmentContact: {
                            select: { contactId: true },
                        },
                    },
                    take: parsedLimit,
                    skip: (parsedPage - 1) * parsedLimit,
                    orderBy: { [finalSortBy]: finalSortOrder },
                }),
                this.prisma.segment.count({ where }),
            ]);

            // console.log("segments on service of getSegments", segments);

            return {
                segments: segments.map(segment => ({
                    id: segment.id.toString(),
                    name: segment.name,
                    filters: segment.filters,
                    contactIds: segment.segmentContact.map(sc => sc.contactId.toString()),
                })),
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit),
                message: segments.length === 0 ? 'No segments found for the given criteria.' : undefined,
            };
        } catch (error) {
            // Handle Prisma-specific errors
            if (error) {
                this.logger.error(`Prisma error: ${error.message}`, error.stack);
                return {
                    segments: [],
                    total: 0,
                    page: parsedPage,
                    limit: parsedLimit,
                    totalPages: 0,
                    message: `Invalid query parameters: ${error.message}`,
                };
            }

            // Handle unexpected errors
            this.logger.error(`Failed to fetch segments: ${error.message}`, error.stack);
            return {
                segments: [],
                total: 0,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: 0,
                message: 'An unexpected error occurred while fetching segments.',
            };
        }
    }


    // get segment by id
    async getSegmentById(userId: bigint, agencyId: bigint, segmentId: number) {
        try {
            const segment = await this.prisma.segment.findUnique({
                where: { id: segmentId },
                include: {
                    segmentContact: {
                        select: { contactId: true },
                    },
                },
            });
            if (!segment) {
                this.logger.warn(`Segment ${segmentId} not found`);
                throw new NotFoundException(`Segment ${segmentId} not found`);
            }
            return {
                id: segment.id,
                name: segment.name,
                filters: segment.filters,
                contactIds: segment.segmentContact.map(sc => sc.contactId),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch segment ${segmentId}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to fetch segment');
        } finally {
            this.prisma.$disconnect().catch(error => {
                if (error instanceof Error) {
                    this.logger.error(`Failed to disconnect from Prisma: ${error.message}`);
                }
            })
        }
    }

    // delete segment
    async deleteSegment(userId: bigint, agencyId: bigint, segmentId: number) {
        try {
            const segment = await this.prisma.segment.findUnique({ where: { id: segmentId, userId, agencyId } });
            if (!segment) {
                this.logger.warn(`Segment ${segmentId} not found`);
                throw new NotFoundException(`Segment ${segmentId} not found`);
            }
            await this.prisma.segment.delete({ where: { id: segmentId } });
            return { message: `Segment ${segmentId} deleted successfully` };
        } catch (error) {
            this.logger.error(`Failed to delete segment ${segmentId}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to delete segment');
        }
    }

    // contact list by segment
    async getContactsBySegmentId(userId: bigint, agencyId: bigint, segmentId: number, dto: GetContactsBySegmentIdDto) {

        // extract firstName and lastName from dto
        const { firstName, lastName } = dto;

        // console.log("dto on service", dto);


        try {
            const segment = await this.prisma.segment.findUnique({ where: { id: segmentId, userId }, include: { segmentContact: true } });
            // console.log('Segment found:', segment);
            if (!segment) {
                this.logger.warn(`Segment ${segmentId} not found`);
                throw new NotFoundException(`Segment ${segmentId} not found`);
            }

            const contactIds = segment.segmentContact.map(sc => sc.contactId);
            if (contactIds.length === 0) {
                this.logger.warn(`No contacts found for segment ${segmentId}`);
                return { contacts: [], total: 0, page: 1, limit: dto.limit || 10, totalPages: 0, message: 'No contacts found for this segment.' };
            }
            const { page = '1', limit = '10', searchQuery } = dto;
            const parsedPage = Math.max(1, Number(page));
            const parsedLimit = Math.min(Math.max(1, Number(limit)), 100);
            const where: Prisma.ContactWhereInput = { id: { in: contactIds } };

            const orConditions: Prisma.ContactWhereInput[] = [];

            if (firstName?.trim()) {
                orConditions.push({ firstName: { contains: firstName.trim() } });
            }
            if (lastName?.trim()) {
                orConditions.push({ lastName: { contains: lastName.trim() } });
            }

            if (searchQuery?.trim()) {
                where.OR = [
                    { email: { contains: searchQuery.trim() } },
                    { number: { contains: searchQuery.trim() } },
                ];
            }

            if (orConditions.length > 0) {
                where.OR = orConditions;
            }

            const [contacts, total] = await Promise.all([
                this.prisma.contact.findMany({
                    where,
                    take: parsedLimit,
                    skip: (parsedPage - 1) * parsedLimit,
                    orderBy: { createdAt: 'desc' },
                }),
                this.prisma.contact.count({ where }),
            ]);
            return {
                contacts,
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit),
                message: contacts.length === 0 ? 'No contacts found for this segment.' : undefined,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch contacts for segment ${segmentId}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to fetch contacts for segment');
        }
    }

    // bulk add more contacts to segment but will not add duplicates on same contactId
    async addContactsToSegment(user: LoginUser, id: number, contactIds: bigint[]) {
        try {
            const segment = await this.prisma.segment.findUnique({ where: { id: id, userId: user.parentUserId ?? user.id } });
            if (!segment) {
                this.logger.warn(`Segment ${id} not found`);
                throw new NotFoundException(`Segment ${id} not found`);
            }
            await this.prisma.segmentContact.createMany({
                data: contactIds.map(contactId => ({
                    userId: user.parentUserId ?? user.id,
                    agencyId: user.agencyId,
                    createdBy: user.id,
                    segmentId: id,
                    contactId: BigInt(contactId),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })),
                skipDuplicates: true, // Skip duplicates to avoid unique constraint violations
            });
            return { message: `Contacts added to segment ${id} successfully` };
        } catch (error) {
            this.logger.error(`Failed to add contacts to segment ${id}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to add contacts to segment');
        } finally {
            this.prisma.$disconnect().catch(error => {
                if (error instanceof Error) {
                    this.logger.error(`Failed to disconnect from Prisma: ${error.message}`);
                }
            })
        }
    }


    // contact from segment delete
    async deleteContactsBySegmentId(userId: bigint, agencyId: bigint, segmentId: number, contactId: number) {
        try {
            await this.prisma.segmentContact.deleteMany({
                where: {
                    contactId: contactId,
                    segmentId: segmentId,
                    userId: userId,
                    agencyId: agencyId,
                },
            });
            return { message: `Contact ${contactId} deleted from segment ${segmentId} successfully` };
        } catch (error) {
            this.logger.error(`Failed to delete contact ${contactId} from segment ${segmentId}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to delete contact from segment');
        }
    }


    // bulk delete contacts from segment with array of contactIds
    async bulkDeleteContactsBySegmentId(userId: bigint, agencyId: bigint, segmentId: number, contactIds: bigint[]) {
        try {
            await this.prisma.segmentContact.deleteMany({
                where: {
                    contactId: { in: contactIds },
                    segmentId: segmentId,
                    userId: userId,
                    agencyId: agencyId,
                },
            });
            return { message: `Contacts ${contactIds} deleted from segment ${segmentId} successfully` };
        } catch (error) {
            this.logger.error(`Failed to delete contacts ${contactIds} from segment ${segmentId}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to delete contacts from segment');
        } finally {
            this.prisma.$disconnect().catch(error => {
                if (error instanceof Error) {
                    this.logger.error(`Failed to disconnect from Prisma: ${error.message}`);
                }
            })
        }
    }


    // assign segment to team member
    async assignSegmentToMember(userId: bigint, agencyId: bigint, dto: AssignSegmentToMemberDto) {
        const { memberId, segmentId } = dto;

        try {
            // Fetch teamId for the member
            const member = await this.prisma.teamMember.findFirst({
                where: {
                    memberId: memberId,
                    agencyId: agencyId,
                },
                select: { teamId: true },
            });

            if (!member || !member.teamId) {
                this.logger.warn(`Team not found for member ${memberId}`);
                throw new NotFoundException(`Team not found for member ${memberId}`);
            }

            // Verify segment exists
            const segment = await this.prisma.segment.count({ where: { id: segmentId, userId, agencyId } });
            if (!segment) {
                this.logger.warn(`Segment ${segmentId} not found`);
                throw new NotFoundException(`Segment ${segmentId} not found`);
            }

            // Fetch contactIds from segmentContact
            const segmentContacts = await this.prisma.segmentContact.findMany({
                where: { segmentId: segmentId },
                select: { contactId: true },
            });

            if (segmentContacts.length === 0) {
                this.logger.warn(`No contacts found for segment ${segmentId}`);
                throw new NotFoundException(`No contacts found for segment ${segmentId}`);
            }

            const segmentContactIds = segmentContacts.map(contact => BigInt(contact.contactId));

            // Fetch existing contactIds for memberId in contactAssignment
            const existingAssignments = await this.prisma.contactAssignment.findMany({
                where: {
                    userId: memberId,
                    // agencyId: agencyId,
                },
                select: { contactId: true },
            });

            const existingContactIds = existingAssignments.map(assignment => BigInt(assignment.contactId));

            // Filter out already assigned contactIds
            const newContactIds = segmentContactIds.filter(
                contactId => !existingContactIds.includes(contactId)
            );

            if (newContactIds.length === 0) {
                this.logger.warn(`All contacts in segment ${segmentId} are already assigned to member ${memberId}`);
                throw new BadRequestException(`No new contacts to assign for segment ${segmentId}`);
            }

            const user = await this.prisma.user.findUnique({
                where: { id: userId }
            })

            for (const contactId of newContactIds) {

                // Assign contacts (skip duplicates)
                const assignments = [];


                try {

                    const assignment = await this.prisma.contactAssignment.create({
                        data: {
                            agencyId: user.agencyId,
                            userId: user.parentUserId ?? user.id,
                            contactId,
                            assignedBy: user.id,
                            assignedTo: dto.memberId as bigint,
                            createdAt: new Date(),
                            updatedAt: new Date()

                        }
                    });

                    assignments.push(assignment);

                } catch (error) {
                    console.log(error);
                }


            }

            return { message: `Segment ${segmentId} assigned to member ${memberId} successfully` };

        } catch (error) {
            this.logger.error(`Failed to assign segment ${segmentId} to member ${memberId}: ${error.message}`);
            throw new BadRequestException(error.message || 'Failed to assign segment to member');
        } finally {
            this.prisma.$disconnect().catch(error => {
                if (error instanceof Error) {
                    this.logger.error(`Failed to disconnect from Prisma: ${error.message}`);
                }
            });
        }
    }


    async findActiveContactBySegmentId(userId: bigint, segmentId: bigint): Promise<{ contactId: bigint }[]> {
        try {

            return await this.prisma.segmentContact.findMany({
                where: {
                    userId: userId,
                    segmentId: segmentId,
                    contact: {
                        status: ContactStatus.ACTIVE
                    }
                },
                select: {
                    contactId: true
                }
            })

        } catch (error) {
            this.logger.error(`Failed to fetch segment contact ${segmentId}`);
        }


    }

}