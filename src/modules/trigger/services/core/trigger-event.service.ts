import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { SearchUtils } from '@/utils/search.utils';
import { CommonGetTriggerDto } from '../../dto/common-get-trigger.dto';

@Injectable()
export class TriggerEventService {

    constructor(private prisma: PrismaService, private readonly logger: PinoLogger) {
        this.logger.setContext(TriggerEventService.name);
    }


    async create(data: { key: string; title: string; description?: string; metadata?: any }) {  // Extended to explicitly allow metadata
        try {
            return await this.prisma.triggerEvent.create({ data });
        } catch (error) {
            this.logger.error('Error creating trigger event', error.stack);
            throw new BadRequestException('Failed to create trigger event');
        }
    }





    async findAll(query: CommonGetTriggerDto) {
        try {
            const { search, limit = 10, page = 1 } = query;
            const skip = (page - 1) * limit;

            // Build base where clause (empty in this case)
            const baseWhere: Prisma.TriggerEventWhereInput = {};

            // Apply search using SearchUtils if search is provided
            const where = search
                ? SearchUtils.applySearch<Prisma.TriggerEventWhereInput>(
                    baseWhere,
                    search,
                    {
                        fields: ['title'], // Search in title field
                        strategy: 'ALL', // Use 'ALL' for precise search results
                        minTermLength: 2, // Ignore terms shorter than 2 characters
                        maxTerms: 5, // Limit to 5 search terms
                        caseSensitive: false // Rely on database collation for case sensitivity
                    }
                )
                : baseWhere;

            const [events, total] = await Promise.all([
                this.prisma.triggerEvent.findMany({
                    where,
                    take: limit,
                    skip,
                    orderBy: { title: 'asc' },
                }),
                this.prisma.triggerEvent.count({ where }),
            ]);

            return {
                events,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.log('Error fetching trigger events', error);
            this.logger.error('Error fetching trigger events', error.stack);
            throw new BadRequestException('Failed to fetch trigger events');
        }
    }

    async findOne(id: bigint) {
        try {
            const event = await this.prisma.triggerEvent.findUnique({ where: { id } });
            if (!event) throw new NotFoundException('Trigger event not found');
            return event;
        } catch (error) {
            this.logger.error(`Error fetching trigger event ${id}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Failed to fetch trigger event');
        }
    }

    async update(id: bigint, data: { title?: string; description?: string; metadata?: any }) {  // Extended to allow metadata
        try {
            return await this.prisma.triggerEvent.update({ where: { id }, data });
        } catch (error) {
            this.logger.error(`Error updating trigger event ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Trigger event not found');
            throw new BadRequestException('Failed to update trigger event');
        }
    }
    async remove(id: bigint) {
        try {
            return await this.prisma.triggerEvent.delete({ where: { id } });
        } catch (error) {
            this.logger.error(`Error deleting trigger event ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Trigger event not found');
            throw new BadRequestException('Failed to delete trigger event');
        }
    }
}