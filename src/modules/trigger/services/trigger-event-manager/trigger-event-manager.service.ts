import { Injectable, Logger } from '@nestjs/common';
import { TriggerQueueStatus, TriggerStatus } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';
import { type CreateTriggerEventQueueDto } from '../../dto/trigger-event-manager.dto';
import type { EventKeys } from 'src/types/triggers';
import { ActiveTriggerEventConfig } from '../../dto/trigger.event.config.dto';
import { ConfigService } from '@nestjs/config';


/**
 * Manages trigger event queue operations, providing reusable methods for creating and handling trigger events.
 */
@Injectable()
export class TriggerEventManager {
    private readonly logger = new Logger(TriggerEventManager.name);

    constructor(private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Creates a trigger event queue entry for a given event key with dynamic payload.
     * Fetches trigger event ID and creates a cache entry in the trigger event queue.
     *
     * @param params - Parameters for creating the trigger event queue entry
     * @param params.agencyId - The ID of the agency
     * @param params.userId - The ID of the user (or parent user if applicable)
     * @param params.contactId - The ID of the contact
     * @param params.eventKey - The event key (e.g., CONTACT_ADDED)
     * @param params.payload - Optional additional payload data
     * @returns The created cache trigger event queue entry
     * @throws Error if trigger event ID is not found or queue creation fails
     */
    async createTriggerEventQueue({
        agencyId,
        userId,
        contactId,
        eventKey,
        payload = {},
    }: CreateTriggerEventQueueDto) {
        try {

            if (!contactId || !userId || !agencyId) {
                this.logger.error(`No contactId,userId or agencyId provided for event key: ${eventKey}`);
                return;
            }

            // Fetch trigger event ID
            const triggerEventId = await this.prisma.triggerEvent.findFirst({
                where: { key: eventKey },
                select: { id: true },
            });

            if (!triggerEventId) {
                this.logger.error(`No trigger event found for key: ${eventKey}`);
                return;
            }


            const userTriggerConfig = this.configService.get('USE_TRIGGER_CONFIG', 'true') === 'true';
            if (userTriggerConfig) {
                const activeTriggerEventConfig: ActiveTriggerEventConfig[] = await this.getActiveTriggerEventConfigs(agencyId, userId, eventKey);
                if (activeTriggerEventConfig.length === 0) {
                    this.logger.error(`No active triggers found for event key: ${eventKey}`);
                }
                await this.queueTriggerEvent(activeTriggerEventConfig, { userId, contactId, agencyId, eventKey, payload });
                return;
            }

            const triggerCount = await this.countActiveTriggerEventConfigs(agencyId, userId, eventKey);
            console.log(`Trigger count for ${eventKey}: ${triggerCount}`);

            if (triggerCount === 0) {
                this.logger.error(`No active triggers found for event key: ${eventKey}`);
                return;
            }

            // Merge default payload with provided payload
            const finalPayload: CreateTriggerEventQueueDto = {
                contactId,
                userId,
                agencyId,
                eventKey,
                ...payload,
            };

            // console.log({payload,finalPayload});

            // Create cache trigger event queue entry
            const cacheTriggerEventQueue = await this.prisma.cacheTriggerEventQueue.create({
                data: {
                    userId,
                    contactId,
                    agencyId,
                    triggerEventType: eventKey,
                    triggerEventId: triggerEventId.id,
                    status: TriggerQueueStatus.PENDING,
                    scheduleAt: new Date(),
                    payload: JSON.stringify(finalPayload),
                },
            });

            this.logger.debug(`Created trigger event queue for ${eventKey}: ${cacheTriggerEventQueue.id}`);
            return cacheTriggerEventQueue;
        } catch (error) {
            this.logger.error(`Failed to create trigger event queue for ${eventKey}: ${error.message}`);
        }

    }

    private async queueTriggerEvent(activeTriggerEventConfig: ActiveTriggerEventConfig[], createTriggerEventQueueDto: CreateTriggerEventQueueDto) {
        for (const config of activeTriggerEventConfig) {

            await this.prisma.cacheTriggerEventQueue.create({
                data: await this.buildCacheTriggerQueue(config, createTriggerEventQueueDto)
            });

        }
    }

    private async buildCacheTriggerQueue(activeTriggerEventConfig: ActiveTriggerEventConfig, createTriggerEventQueueDto: CreateTriggerEventQueueDto) {
        const cacheTriggerQueue = {
            userId: createTriggerEventQueueDto.userId,
            contactId: createTriggerEventQueueDto.contactId,
            agencyId: createTriggerEventQueueDto.agencyId,
            triggerEventType: createTriggerEventQueueDto.eventKey,
            triggerEventId: activeTriggerEventConfig.triggerEventId,
            triggerId: activeTriggerEventConfig.triggerId,
            triggetEventConfigId: activeTriggerEventConfig.id,
            status: TriggerQueueStatus.PENDING,
            scheduleAt: new Date(),
            payload: JSON.stringify({
                ...createTriggerEventQueueDto.payload,
                userId: createTriggerEventQueueDto.userId,
                contactId: createTriggerEventQueueDto.contactId,
                agencyId: createTriggerEventQueueDto.agencyId,
                triggerEventType: createTriggerEventQueueDto.eventKey,
                triggerEventId: activeTriggerEventConfig.triggerEventId,
                triggerId: activeTriggerEventConfig.triggerId,
                triggetEventConfigId: activeTriggerEventConfig.id,
            }),
        }

        return cacheTriggerQueue;
    }


    async createTriggerEventQueues(
        createTriggerEventQueueDtos
            : CreateTriggerEventQueueDto[]): Promise<void> {
        try {

            for (const params of createTriggerEventQueueDtos) {
                await this.createTriggerEventQueue(params);
            }

        } catch (error) {
            this.logger.error(`Failed to create trigger event queue for ${createTriggerEventQueueDtos[0]?.eventKey}: ${error.message}`);
        }

    }

    private async getActiveTriggerEventConfigs(agencyId: bigint, userId: bigint, eventKey: EventKeys): Promise<ActiveTriggerEventConfig[]> {
        return this.prisma.triggerEventConfig.findMany({
            where: {
                agencyId,
                userId,
                trigger: { status: TriggerStatus.ACTIVE },
                event: {
                    key: eventKey
                },
            },
            select: { id: true, triggerEventId: true, triggerId: true },
        });
    }

    private async countActiveTriggerEventConfigs(agencyId: bigint, userId: bigint, eventKey: EventKeys): Promise<number> {
        return await this.prisma.triggerEventConfig.count({
            where: {
                agencyId: agencyId,
                userId: userId,
                trigger: {
                    status: TriggerStatus.ACTIVE,
                },
                event: {
                    key: eventKey,
                },
            },
        });
    }


}