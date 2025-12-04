import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { SearchUtils } from '@/utils/search.utils';
import { CommonGetTriggerDto } from '../../dto/common-get-trigger.dto';
import { allowedEvents, type EventKeys } from 'src/types/triggers';
@Injectable()
export class TriggerActionService {

    constructor(private prisma: PrismaService, private readonly logger: PinoLogger) {
        this.logger.setContext(TriggerActionService.name);
    }


    async create(data: { key: string; title: string; description?: string; metadata?: any }) {  // Extended for metadata
        try {
            return await this.prisma.triggerAction.create({ data });
        } catch (error) {
            this.logger.error('Error creating trigger action', error.stack);
            throw new BadRequestException('Failed to create trigger action');
        }
    }
    async findAll(query: CommonGetTriggerDto) {
        try {
            const { search, limit = 10, page = 1, eventKey } = query;
            const skip = (page - 1) * limit;

            // Build base where clause
            let baseWhere: Prisma.TriggerActionWhereInput = {};

            // If eventKey provided, filter actions to only those allowed for that event
            if (eventKey) {
                const validEventKey = eventKey as EventKeys;
                const allowedActionKeys = allowedEvents[validEventKey] || [];
                if (allowedActionKeys.length === 0) {
                    this.logger.warn(`No allowed actions for eventKey: ${eventKey}. Returning empty list.`);
                    return {
                        actions: [],
                        total: 0,
                        page,
                        limit,
                        totalPages: 0,
                    };
                }
                baseWhere.key = { in: allowedActionKeys };
                this.logger.debug(`Filtering actions for eventKey: ${eventKey}. Allowed: ${allowedActionKeys.join(', ')}`);
            }

            // Apply search using SearchUtils if search is provided
            const where = search
                ? SearchUtils.applySearch<Prisma.TriggerActionWhereInput>(
                    baseWhere,
                    search,
                    {
                        fields: ['title'], // Search in title field
                        strategy: 'ALL', // Use 'ALL' for precise search results
                        minTermLength: 2, // Ignore terms shorter than 2 characters
                        maxTerms: 5, // Limit to 5 search terms
                        caseSensitive: false, // Rely on database collation for case sensitivity
                    },
                )
                : baseWhere;

            const [actions, total] = await Promise.all([
                this.prisma.triggerAction.findMany({
                    where,
                    take: limit,
                    skip,
                    orderBy: { title: 'asc' },
                }),
                this.prisma.triggerAction.count({ where }),
            ]);

            this.logger.info(`Fetched ${actions.length} trigger actions (page ${page}, limit ${limit}, eventKey: ${eventKey || 'all'})`);

            return {
                actions,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            this.logger.error('Error fetching trigger actions', error.stack);
            throw new BadRequestException('Failed to fetch trigger actions');
        }
    }

    async findOne(id: bigint) {
        try {
            const action = await this.prisma.triggerAction.findUnique({ where: { id } });
            if (!action) throw new NotFoundException('Trigger action not found');
            return action;
        } catch (error) {
            this.logger.error(`Error fetching trigger action ${id}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Failed to fetch trigger action');
        }
    }




    async update(id: bigint, data: { title?: string; description?: string; metadata?: any }) {  // Extended for metadata
        try {
            return await this.prisma.triggerAction.update({ where: { id }, data });
        } catch (error) {
            this.logger.error(`Error updating trigger action ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Trigger action not found');
            throw new BadRequestException('Failed to update trigger action');
        }
    }

    async remove(id: bigint) {
        try {
            return await this.prisma.triggerAction.delete({ where: { id } });
        } catch (error) {
            this.logger.error(`Error deleting trigger action ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Trigger action not found');
            throw new BadRequestException('Failed to delete trigger action');
        }
    }
}