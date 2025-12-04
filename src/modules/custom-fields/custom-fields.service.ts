import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { CreateCustomFieldDto, GetCustomFieldsDto, UpdateCustomFieldDto } from "./dto/create-custom-field.dto";
import { Prisma } from "@prisma/client";
import { VALID_CUSTOM_FIELD_TYPES } from "@/utils/global-constant";
import { normalizeKey } from "../personalization/utils/personalization-helper";
import { LoginUser } from "../auth/dto/login-user.dto";
import { SearchUtils } from "@/utils/search.utils";

@Injectable()
export class CustomFieldsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ) { }

    async createCustomField(user: LoginUser, dto: CreateCustomFieldDto) {
        try {
            // Normalize key
            let normalizedKey = await normalizeKey(dto.key);
            const customField = await this.prisma.customField.create({
                data: {
                    key: normalizedKey,
                    label: dto.label,
                    type: dto.type,
                    defaultValue: dto.defaultValue,
                    userId: user.parentUserId ?? user.id,
                    agencyId: user.agencyId ? user.agencyId : null,
                    createdBy: user.id
                },
            });
            return customField;
        } catch (error) {
            if (error.code === 'P2002') { // Prisma unique constraint violation
                throw new BadRequestException('A custom field with this label already exists for the user.');
            }
            throw error;
        }
    }

    async updateCustomField(user: LoginUser, id: number, dto: UpdateCustomFieldDto) {
        try {
            // Normalize key
            let normalizedKey = await normalizeKey(dto.key);
            //  Check duplicate label before updating
            const existing = await this.prisma.customField.count({
                where: {
                    userId: user.parentUserId ?? user.id,
                    label: dto.label,
                    NOT: { id: id }, // exclude the current field being updated
                },
            });

            if (existing) {
                throw new BadRequestException(
                    'A custom field with this label already exists for the user.'
                );
            }

            await this.prisma.customField.update({
                where: { id },
                data: {
                    key: normalizedKey,
                    label: dto.label,
                    type: dto.type,
                    defaultValue: dto.defaultValue,
                    updatedAt: new Date(),
                },
            });

            return {
                message: 'Custom field updated successfully.',
                statusCode: 200,
            };
        } catch (error) {
            throw error; // Let NestJS handle other errors
        }
    }


    // delete custom field
    async deleteCustomField(user: LoginUser, id: number) {
        try {
            // Check if custom field exists for this user
            const customField = await this.prisma.customField.count({
                where: { id, userId: user.parentUserId ?? user.id },
            });

            if (!customField) {
                throw new NotFoundException(`Custom field with ID ${id} not found.`);
            }

            // Proceed with delete
            await this.prisma.customField.delete({
                where: { id },
            });

            return { message: 'Custom field deleted successfully.' };
        } catch (error) {
            this.logger.error(`Failed to delete custom field: ${error.message}`);

            if (error.code === 'P2003') {
                // Foreign key constraint violation
                throw new BadRequestException(
                    'Cannot delete custom field as it is associated with existing contacts.',
                );
            }

            throw new BadRequestException(
                `Failed to delete custom field: ${error.message}`,
            );
        }
    }


    async getCustomFields(user: LoginUser, dto: GetCustomFieldsDto) {
        const { page = 1, limit = 10, label, type, sortBy = 'createdAt', sortOrder = 'desc' } = dto;

        // Early bail on invalid type—no partial builds
        if (type && !VALID_CUSTOM_FIELD_TYPES.includes(type.toUpperCase() as typeof VALID_CUSTOM_FIELD_TYPES[number])) {
            return {
                customFields: [],
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 0,
                message: `Invalid type value: ${type}. Expected one of ${VALID_CUSTOM_FIELD_TYPES.join(', ')}.`,
            };
        }

        // NaN-proof pagination—safe defaults on junk
        const parsedPage = isNaN(Number(page)) ? 1 : Math.max(1, Number(page));
        const parsedLimit = isNaN(Number(limit))
            ? 10
            : Math.min(Math.max(1, Number(limit)), 100); // Cap to keep queries chill

        // Sanitize sort—fallback to safe defaults
        const validSortFields = ['label', 'type', 'createdAt', 'updatedAt'] as const;
        const validSortOrders = ['asc', 'desc'] as const;
        const finalSortBy = validSortFields.includes(sortBy as any) ? sortBy : 'createdAt';
        const finalSortOrder = validSortOrders.includes(sortOrder as any) ? sortOrder : 'desc';

        // Base where—agency/user scoped
        const baseWhere: Prisma.CustomFieldWhereInput = {
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
        };

        // Layer type filter (exact, uppercased for enum match)
        if (type?.trim()) {
            baseWhere.type = { equals: type.trim().toUpperCase() };
        }

        // Apply label search via Utils (mirrors findAll flow)
        let where: Prisma.CustomFieldWhereInput = baseWhere;
        if (label?.trim()) {
            const searchTerms = label.trim().split(/\s+/).filter(t => t.length >= 2).slice(0, 5);
            if (searchTerms.length > 0) {
                this.logger.debug?.(`Applying search for terms: ${searchTerms.join(', ')}`); // Optional verbose
                where = SearchUtils.applySearch<Prisma.CustomFieldWhereInput>(baseWhere, label.trim(), {
                    fields: ['label'],
                    strategy: 'ALL', // All terms must hit (like triggers)
                    minTermLength: 2,
                    maxTerms: 5,
                    caseSensitive: false,
                }) as Prisma.CustomFieldWhereInput;
            }
        }

        try {
            const [customFields, total] = await Promise.all([
                this.prisma.customField.findMany({
                    where,
                    take: parsedLimit,
                    skip: (parsedPage - 1) * parsedLimit,
                    orderBy: { [finalSortBy]: finalSortOrder as any },
                }),
                this.prisma.customField.count({ where }),
            ]);

            return {
                customFields,
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit),
                message: customFields.length === 0 ? 'No custom fields found matching your search.' : undefined,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch custom fields: ${error.message}`, error.stack);
            throw new BadRequestException(error?.message || 'Failed to fetch custom fields—check your params, fam.');
        }
    }
    // get all the custom fields for a contact
    async getCustomFieldsForContact(user: LoginUser) {
        // console.log("getCustomFieldsForContact", agencyId, userId);
        const userId = user.parentUserId ?? user.id;
        if (!user.agencyId || !userId) {
            throw new BadRequestException('Agency ID and User ID are required to fetch custom fields for a contact.');
        }
        try {
            const customFields = await this.prisma.customField.findMany({
                where: { agencyId: user.agencyId, userId },
            });
            // console.log("Custom fields for contact:", customFields);
            return customFields.map(field => ({
                id: field.id,
                label: field.label,
                type: field.type,
                value: field.defaultValue,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch custom fields for contact ${user.parentUserId ?? user.id}: ${error.message}`);
            throw new BadRequestException('Failed to fetch custom fields for contact');
        }
    }

}