import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateTriggerDto } from '../../dto/create-trigger.dto';
import { UpdateTriggerDto } from '../../dto/update-trigger.dto';
import { Prisma, TriggerStatus } from '@prisma/client';
import { SearchUtils } from '@/utils/search.utils';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import { CommonGetTriggerDto } from '../../dto/common-get-trigger.dto';
import { LoginUser } from '../../../auth/dto/login-user.dto';
import { TriggerUtils } from '../../utils/trigger.utils';
import { TRIGGER_FILTER_FIELDS, TRIGGER_FILTER_OPERATORS } from '../../constants/trigger.constant';

@Injectable()
export class TriggerService {
    constructor(
        private prisma: PrismaService,
        private readonly logger: PinoLogger,
    ) {
        this.logger.setContext(TriggerService.name);
    }

    async create(createTriggerDto: CreateTriggerDto, user: LoginUser) {
        try {
            const { id: userId, agencyId } = user;

            // const existing = await this.prisma.trigger.findFirst({
            //     where: { agencyId, title, userId },
            // });
            // if (existing) throw new ConflictException('Trigger title already exists. Trigger title must be unique.');

            return await this.prisma.trigger.create({
                data: {
                    ...createTriggerDto,
                    userId: user?.parentUserId || userId,
                    agencyId,
                    createdBy: userId,
                    timezone: createTriggerDto?.timezone ?? user?.timeZone
                }
            });
        } catch (error) {
            this.logger.error('Error creating trigger', error.stack);
            if (error instanceof ConflictException) throw error;
            throw new BadRequestException(error?.message || 'Failed to create trigger');
        }
    }

    async findAll(query: CommonGetTriggerDto, user: LoginUser) {
        try {
            const { search, limit = 10, page = 1, status } = query;
            const skip = (page - 1) * limit;
            const baseWhere: Prisma.TriggerWhereInput = {
                agencyId: user.agencyId,
                userId: user?.parentUserId || user.id
            };

            if (status) baseWhere.status = status;

            const where = search
                ? SearchUtils.applySearch<Prisma.TriggerWhereInput>(baseWhere, search, {
                    fields: ['title', 'description'],
                    strategy: 'ALL',
                    minTermLength: 2,
                    maxTerms: 5,
                    caseSensitive: false,
                })
                : baseWhere;

            const [triggers, total] = await Promise.all([
                this.prisma.trigger.findMany({
                    where,
                    take: limit,
                    skip,
                    orderBy: { updatedAt: 'desc' },
                    // include: { TriggerEventConfig: true, TriggerActionConfig: true },
                }),
                this.prisma.trigger.count({ where }),
            ]);

            return {
                triggers,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            this.logger.error('Error fetching triggers', error.stack);
            throw new BadRequestException(error?.message || 'Failed to fetch triggers');
        }
    }

    async findOne(id: bigint, user: LoginUser, eventKey?: string) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
                include: {
                    TriggerEventConfig: {
                        include: {
                            event: {
                                select: { id: true, key: true, title: true, metadata: true },
                            },
                        },
                    },
                    TriggerActionConfig: {
                        include: {
                            triggerAction: {
                                select: { id: true, key: true, title: true, description: true, metadata: true },
                            },
                        },
                    },
                },
            });

            if (!trigger) throw new NotFoundException("Trigger not found");

            const relevantEventConfigs = eventKey
                ? trigger.TriggerEventConfig.filter((ec) => ec.event.key === eventKey)
                : trigger.TriggerEventConfig.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            const latestEventConfig = relevantEventConfigs[0] || null;


            // Convert on_day filter time from UTC to local timezone with AM/PM
            const processedFilters = (latestEventConfig?.filters as any[] || [])?.map((filter) => {
                if (filter.field === TRIGGER_FILTER_FIELDS.ON_DAY && filter.operator === TRIGGER_FILTER_OPERATORS.EQUALS && trigger.timezone) {
                    try {
                        return {
                            ...filter,
                            value: TriggerUtils.convertOnDayTimeToLocal(filter.value, trigger.timezone),
                        };
                    } catch (error) {
                        this.logger.error(`Failed to convert on_day time ${filter.value} to local timezone ${trigger.timezone}: ${error.message}`);
                        return filter; // Return original filter if conversion fails
                    }
                }
                return filter;
            }) || [];

            return {
                id: trigger.id,
                title: trigger.title,
                event: latestEventConfig?.event
                    ? {
                        key: latestEventConfig.event.key,
                        title: latestEventConfig.event.title,
                        metadata: latestEventConfig.event.metadata || { availableFilters: [] },
                    }
                    : null,
                filters: processedFilters || [],
                actions: (trigger.TriggerActionConfig || [])
                    .filter((ac) => ac.triggerEventConfigId === latestEventConfig?.id)
                    .map((ac) => ({
                        id: ac.id,
                        title: ac.triggerAction?.title || "",
                        description: ac.triggerAction?.description || "",
                        actionKey: ac.triggerAction?.key || "",
                        config: ac.configs || {},
                        metadata: ac.triggerAction?.metadata || { configFields: [] },
                    })),
                description: trigger.description || "",
                status: trigger.status,
                priority: trigger.priority,
                timezone: trigger.timezone || "",
                metadata: trigger.metadata || null,
                version: trigger.version,
                createdBy: trigger.createdBy || null,
                updatedBy: trigger.updatedBy || null,
                createdAt: trigger.createdAt,
                updatedAt: trigger.updatedAt,
                deletedAt: trigger.deletedAt || null,
                liveMode: trigger.liveMode,
            };
        } catch (error) {
            this.logger.error(`Error fetching trigger ${id}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException(error?.message || "Failed to fetch trigger");
        }
    }

    async update(id: bigint, updateTriggerDto: UpdateTriggerDto, user: LoginUser) {
        try {
            // if (updateTriggerDto.title) {
            //     const existing = await this.prisma.trigger.findFirst({
            //         where: { title: updateTriggerDto.title, agencyId, userId: user.id },
            //     });
            //     if (existing) throw new ConflictException('Trigger title already exists. Trigger title must be unique.');
            // }

            return await this.prisma.trigger.update({
                where: { id, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
                data: {
                    ...updateTriggerDto,
                    updatedBy: user.id,
                    updatedAt: new Date()
                },
            });
        } catch (error) {
            this.logger.error(`Error updating trigger ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Trigger not found');
            if (error instanceof ConflictException) throw error;
            throw new BadRequestException(error?.message || 'Failed to update trigger');
        }
    }

    async remove(id: bigint, user: LoginUser) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
            });

            if (!trigger) {
                throw new NotFoundException('Trigger not found or access denied');
            }

            return await this.prisma.trigger.delete({ where: { id } });
        } catch (error) {
            this.logger.error(`Error deleting trigger ${id}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException(error?.message || 'Failed to delete trigger');
        }
    }

    async duplicate(id: bigint, user: LoginUser) {
        try {
            const original = await this.prisma.trigger.findUnique({
                where: { id, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
                include: {
                    TriggerEventConfig: {
                        include: {
                            event: true
                        }
                    },
                    TriggerActionConfig: {
                        include: {
                            triggerAction: true
                        }
                    }
                },
            });

            if (!original) throw new NotFoundException('Trigger not found');

            const newTitle = `${original.title} (copy)`;

            const existing = await this.prisma.trigger.findFirst({
                where: { agencyId: user.agencyId, title: newTitle, userId: user?.parentUserId || user.id },
            });
            if (existing) throw new ConflictException('Trigger title must be unique per agency');

            return await this.prisma.$transaction(async (prisma) => {
                const newTrigger = await prisma.trigger.create({
                    data: {
                        userId: original.userId,
                        agencyId: original.agencyId,
                        title: newTitle,
                        description: original.description,
                        status: original.status,
                        priority: original.priority,
                        timezone: original.timezone,
                        metadata: original.metadata,
                        version: original.version,
                        createdBy: user?.id,
                        updatedBy: user?.id,
                        liveMode: original.liveMode
                    },
                });

                const newEventConfigsMap = new Map<bigint, bigint>();

                for (const oldConfig of original.TriggerEventConfig) {
                    const newConfig = await prisma.triggerEventConfig.create({
                        data: {
                            agencyId: original.agencyId,
                            userId: original.userId,
                            triggerId: newTrigger.id,
                            triggerEventId: oldConfig.triggerEventId,
                            filters: oldConfig.filters,
                            configs: oldConfig.configs,
                            version: oldConfig.version,
                            createdBy: user?.id,
                            updatedBy: user?.id,
                        }
                    });
                    newEventConfigsMap.set(oldConfig.id, newConfig.id);
                }

                for (const oldActionConfig of original.TriggerActionConfig) {
                    const newEventConfigId = newEventConfigsMap.get(oldActionConfig.triggerEventConfigId);
                    if (!newEventConfigId) continue;

                    const oldEventConfig = original.TriggerEventConfig.find(ec => ec.id === oldActionConfig.triggerEventConfigId);
                    if (!oldEventConfig) continue;

                    const triggerEventId = oldEventConfig.triggerEventId;

                    await prisma.triggerActionConfig.create({
                        data: {
                            agencyId: original.agencyId,
                            userId: original.userId,
                            triggerId: newTrigger.id,
                            triggerEventId,
                            triggerEventConfigId: newEventConfigId,
                            actionId: oldActionConfig.actionId,
                            configs: oldActionConfig.configs,
                            version: oldActionConfig.version,
                            createdBy: user?.id,
                            updatedBy: user?.id,
                        }
                    });
                }

                return await prisma.trigger.findUnique({
                    where: { id: newTrigger.id },
                    include: { TriggerEventConfig: true, TriggerActionConfig: true },
                });
            });
        } catch (error) {
            this.logger.error(`Error duplicating trigger ${id}`, error.stack);
            if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
            throw new BadRequestException(error?.message || 'Failed to duplicate trigger');
        }
    }

    async assignEvents(triggerId: bigint, eventIds: bigint[], configs: any[], user: LoginUser) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id: triggerId, agencyId: user.agencyId, userId: user?.parentUserId || user.id }
            });

            if (!trigger) {
                throw new NotFoundException('Trigger not found or access denied');
            }

            await this.prisma.triggerEventConfig.createMany({
                data: eventIds.map((triggerEventId, idx) => ({
                    agencyId: user.agencyId,
                    userId: user?.parentUserId || user.id,
                    triggerId,
                    triggerEventId,
                    configs: configs?.[idx] || {},
                    createdBy: user.id,
                    updatedBy: user.id,
                })),
                skipDuplicates: true,
            });
        } catch (error) {
            this.logger.error(`Error assigning events to trigger ${triggerId}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException(error?.message || 'Failed to assign events');
        }
    }

    async assignActions(triggerId: bigint, triggerEventConfigId: bigint, actionIds: bigint[], configs: any[], user: LoginUser) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id: triggerId, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
                include: { TriggerActionConfig: true, TriggerEventConfig: true },
            });

            if (!trigger) {
                throw new NotFoundException('Trigger not found or access denied');
            }

            const eventConfig = await this.prisma.triggerEventConfig.findUnique({
                where: { id: triggerEventConfigId }
            });

            if (!eventConfig || eventConfig.triggerId !== triggerId) {
                throw new NotFoundException('Event config not found or not associated with trigger');
            }

            const triggerEventId = eventConfig.triggerEventId;

            await this.prisma.triggerActionConfig.createMany({
                data: actionIds.map((actionId, idx) => ({
                    agencyId: user.agencyId,
                    userId: user?.parentUserId || user.id,
                    triggerId,
                    triggerEventId,
                    triggerEventConfigId,
                    actionId,
                    configs: configs?.[idx] || {},
                    createdBy: user.id,
                    updatedBy: user.id,
                })),
                skipDuplicates: true,
            });
        } catch (error) {
            this.logger.error(`Error assigning actions to trigger ${triggerId}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException(error?.message || 'Failed to assign actions');
        }
    }

    async updateTriggerWithConfigs(triggerId: bigint, payload: any, user: LoginUser) {
        try {
            return await this.prisma.$transaction(async (prisma) => {
                // Find the trigger
                const trigger = await prisma.trigger.findUnique({
                    where: { id: triggerId, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
                });
                if (!trigger) throw new NotFoundException('Trigger not found or access denied');

                // Prepare filters, converting on_day time to UTC if present
                const processedFilters = payload.filters.map((filter) => {
                    if (filter.field === TRIGGER_FILTER_FIELDS.ON_DAY && filter.operator === TRIGGER_FILTER_OPERATORS.EQUALS) {
                        if (!trigger.timezone) {
                            throw new BadRequestException('Trigger timezone required for on_day filter');
                        }
                        return {
                            ...filter,
                            value: TriggerUtils.convertOnDayTimeToUTC(filter.value, trigger.timezone),
                        };
                    }
                    return filter;
                });

                // Update trigger metadata
                await prisma.trigger.update({
                    where: { id: triggerId },
                    data: {
                        updatedBy: user.id,
                        updatedAt: new Date(),
                        version: { increment: 1 },
                    },
                });

                // Clear all existing TriggerEventConfig (cascades to TriggerActionConfig)
                const deletedConfigs = await prisma.triggerEventConfig.deleteMany({
                    where: { triggerId },
                });
                this.logger.info(`Deleted ${deletedConfigs.count} TriggerEventConfig records for trigger ${triggerId}`);

                // Find the event for the new key
                const event = await prisma.triggerEvent.findUnique({
                    where: { key: payload.event.key },
                });
                if (!event) throw new BadRequestException(`Event with key ${payload.event.key} not found`);
                const triggerEventId = event.id;

                // Create new TriggerEventConfig
                const eventConfig = await prisma.triggerEventConfig.create({
                    data: {
                        agencyId: user.agencyId,
                        userId: user?.parentUserId || user.id,
                        triggerId,
                        triggerEventId,
                        filters: processedFilters,
                        configs: { key: payload.event.key, title: payload.event.title },
                        createdBy: user.id,
                        updatedBy: user.id,
                    },
                });

                // Create new TriggerActionConfig records
                const triggerActionConfig = await Promise.all(
                    payload.actions.map(async (triggerAction) => {
                        const actionEntity = await prisma.triggerAction.findUnique({
                            where: { key: triggerAction.actionKey },
                        });
                        if (!actionEntity) throw new BadRequestException(`Action with key ${triggerAction.actionKey} not found`);
                        const actionId = actionEntity.id;

                        return prisma.triggerActionConfig.create({
                            data: {
                                agencyId: user.agencyId,
                                userId: user?.parentUserId || user.id,
                                triggerId,
                                triggerEventId,
                                triggerEventConfigId: eventConfig.id,
                                actionId,
                                configs: triggerAction.config,
                                createdBy: user.id,
                                updatedBy: user.id,
                            },
                        });
                    }),
                );

                return { eventConfig, triggerActionConfig, triggerId };
            });
        } catch (error) {
            this.logger.error(`Error updating trigger ${triggerId} with configs`, error.stack);
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
            throw new BadRequestException(error?.message || 'Failed to update trigger with configs');
        }
    }

    async removeTriggerConfigs(triggerId: bigint, user: LoginUser) {
        try {
            return await this.prisma.$transaction(async (prisma) => {
                const trigger = await prisma.trigger.findUnique({
                    where: { id: triggerId, agencyId: user.agencyId, userId: user?.parentUserId || user.id },
                });
                if (!trigger) {
                    throw new NotFoundException(`Trigger not found or access denied`);
                }

                await prisma.triggerActionConfig.deleteMany({
                    where: { triggerId },
                });

                await prisma.triggerEventConfig.deleteMany({
                    where: { triggerId },
                });

                await prisma.trigger.update({
                    where: { id: triggerId },
                    data: {
                        updatedBy: user.id,
                        updatedAt: new Date(),
                        version: { increment: 1 },
                    },
                });

                return { triggerId, message: 'All configurations deleted successfully' };
            });
        } catch (error) {
            this.logger.error(`Error removing configurations for trigger ${triggerId}`, error.stack);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(
                error?.message || 'Failed to remove trigger configurations',
            );
        }
    }

    async addEventConfig(triggerId: bigint, triggerEventId: bigint, filters: any = {}, configs: any = {}, user: LoginUser) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id: triggerId, agencyId: user.agencyId, userId: user?.parentUserId || user.id }
            });

            if (!trigger) {
                throw new NotFoundException('Trigger not found or access denied');
            }

            return await this.prisma.triggerEventConfig.create({
                data: {
                    agencyId: user.agencyId,
                    userId: user?.parentUserId || user.id,
                    triggerId,
                    triggerEventId,
                    filters,
                    configs,
                    createdBy: user.id,
                    updatedBy: user.id,
                },
            });
        } catch (error) {
            this.logger.error(`Error adding event config to trigger ${triggerId}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException(error?.message || 'Failed to add event config');
        }
    }

    async updateEventConfig(id: bigint, filters: any = {}, configs: any = {}, user: LoginUser) {
        try {
            return await this.prisma.triggerEventConfig.update({
                where: { id },
                data: {
                    filters,
                    configs,
                    updatedBy: user.id,
                    version: { increment: 1 },
                },
            });
        } catch (error) {
            this.logger.error(`Error updating event config ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Event config not found');
            throw new BadRequestException(error?.message || 'Failed to update event config');
        }
    }

    async removeEventConfig(id: bigint) {
        try {
            return await this.prisma.triggerEventConfig.delete({ where: { id } });
        } catch (error) {
            this.logger.error(`Error removing event config ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Event config not found');
            throw new BadRequestException(error?.message || 'Failed to remove event config');
        }
    }

    async addActionConfig(triggerId: bigint, actionId: bigint, triggerEventConfigId: bigint, configs: any = {}, user: LoginUser) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id: triggerId, agencyId: user.agencyId, userId: user?.parentUserId || user.id }
            });

            if (!trigger) {
                throw new NotFoundException('Trigger not found or access denied');
            }

            const eventConfig = await this.prisma.triggerEventConfig.findUniqueOrThrow({ where: { id: triggerEventConfigId } });
            if (eventConfig.triggerId !== triggerId) {
                throw new NotFoundException('Event config not associated with trigger');
            }

            const triggerEventId = eventConfig.triggerEventId;

            return await this.prisma.triggerActionConfig.create({
                data: {
                    agencyId: user.agencyId,
                    userId: user?.parentUserId || user.id,
                    triggerId,
                    triggerEventId,
                    triggerEventConfigId,
                    actionId,
                    configs,
                    createdBy: user.id,
                    updatedBy: user.id,
                },
            });
        } catch (error) {
            this.logger.error(`Error adding triggerAction config to trigger ${triggerId}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException(error?.message || 'Failed to add triggerAction config');
        }
    }

    async updateActionConfig(id: bigint, configs: any = {}, user: LoginUser) {
        try {
            return await this.prisma.triggerActionConfig.update({
                where: { id },
                data: {
                    configs,
                    updatedBy: user.id,
                    version: { increment: 1 },
                },
            });
        } catch (error) {
            this.logger.error(`Error updating triggerAction config ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Action config not found');
            throw new BadRequestException(error?.message || 'Failed to update triggerAction config');
        }
    }

    async removeActionConfig(id: bigint) {
        try {
            return await this.prisma.triggerActionConfig.delete({ where: { id } });
        } catch (error) {
            this.logger.error(`Error removing triggerAction config ${id}`, error.stack);
            if (error.code === 'P2025') throw new NotFoundException('Action config not found');
            throw new BadRequestException(error?.message || 'Failed to remove triggerAction config');
        }
    }

    // Internal methods (no user context)
    async getTriggerDetailsByEventKey(user: LoginUser, eventKey: string) {
        try {
            const triggers = await this.prisma.trigger.findMany({
                where: {
                    agencyId: user.agencyId,
                    userId: user?.parentUserId || user.id,
                    status: TriggerStatus.ACTIVE,
                    TriggerEventConfig: {
                        some: {
                            event: {
                                key: eventKey,
                            },
                        },
                    },
                },
                include: {
                    TriggerEventConfig: {
                        include: {
                            event: true,
                            TriggerActionConfig: {
                                include: {
                                    triggerAction: true,
                                },
                            },
                        },
                    },
                },
            });

            return triggers;
        } catch (error) {
            this.logger.error(`Error fetching triggers for eventKey ${eventKey} in agency ${user.agencyId}`, error.stack);
            throw new BadRequestException(error?.message || 'Failed to fetch triggers by event key');
        }
    }



    async getTriggerById(triggerId: bigint) {
        try {
            const trigger = await this.prisma.trigger.findUnique({
                where: { id: triggerId },
                include: {
                    TriggerEventConfig: {
                        include: {
                            event: true,
                            TriggerActionConfig: {
                                include: {
                                    triggerAction: true,
                                },
                            },
                        },
                    },
                },
            });

            return trigger;
        } catch (error) {
            this.logger.error(`Error fetching trigger ${triggerId}`, error.stack);
            throw new BadRequestException(error?.message || 'Failed to fetch trigger by ID');
        }
    }
}