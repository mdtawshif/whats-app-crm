// src/services/realtime-trigger-process.service.ts
import { Injectable } from '@nestjs/common';
import { CacheTriggerEventQueue, TriggerAction, TriggerActionConfig, TriggerQueueStatus, TriggerEventExecutionLogStatus, TriggerStatus } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { FilterConditionDto } from '../dto/process-trigger.dto';
import { TriggerValidatorService } from './trigger-validator.service';
import { TriggerExecutionLogService } from './trigger-execution-log.service';
import type { EventKeys } from 'src/types/triggers';

@Injectable()
export class RealtimeTriggerProcessService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService,
        private readonly triggerValidator: TriggerValidatorService, // Inject the new validator service
        private readonly triggerExecutionLogService: TriggerExecutionLogService
    ) {
        this.logger.setContext(this.constructor.name);
    }

    /**
     * Fetches and processes up to 500 pending trigger event queues that are ready to run.
     * Updates their status and delegates to processRealTimeTriggerQueue.
     */
    async processRealTimeTrigger() {
        console.info('Realtime Trigger Process Service Started');

        const pendingTriggerEventQueues = await this.prisma.cacheTriggerEventQueue.findMany({
            where: {
                status: TriggerQueueStatus.PENDING,
                scheduleAt: { lte: new Date() },
            },
            take: 500,
        });

        console.info(`Pending trigger event queues: ${pendingTriggerEventQueues.length}`);

        for (const cacheTriggerEventQueue of pendingTriggerEventQueues) {
            await this.processRealTimeTriggerQueue(cacheTriggerEventQueue);
        }
    }

    /**
     * Processes a trigger queue without a specific config ID by fetching all active configs
     * for the event type and creating new queue entries for each.
     * @param cacheTriggerEventQueue - The queue entry to process
     */
    async processWithTriggerEventType(cacheTriggerEventQueue: CacheTriggerEventQueue) {
        const updatedCacheQueue = await this.prisma.cacheTriggerEventQueue.update({
            where: { id: cacheTriggerEventQueue.id },
            data: { status: TriggerQueueStatus.PROCESSING },
            select: { payload: true, id: true }
        });

        console.info('Processing trigger event type: ', cacheTriggerEventQueue.triggerEventType);

        const triggerEventConfigs = await this.prisma.triggerEventConfig.findMany({
            where: {
                agencyId: cacheTriggerEventQueue.agencyId,
                userId: cacheTriggerEventQueue.userId,
                trigger: {
                    status: TriggerStatus.ACTIVE,
                },
                event: {
                    key: cacheTriggerEventQueue.triggerEventType,
                },
            },
            select: {
                id: true,
                triggerEventId: true,
                triggerId: true
            }
        });

        console.info('Trigger event configs: ', triggerEventConfigs.length);

        for (const triggerEventConfig of triggerEventConfigs) {
            const triggerEventQueue = await this.prisma.cacheTriggerEventQueue.create({
                data: {
                    userId: cacheTriggerEventQueue.userId,
                    contactId: cacheTriggerEventQueue.contactId,
                    agencyId: cacheTriggerEventQueue.agencyId,
                    triggerEventType: cacheTriggerEventQueue.triggerEventType,
                    triggerEventId: triggerEventConfig.triggerEventId,
                    triggerId: triggerEventConfig.triggerId,
                    triggerEventConfigId: triggerEventConfig.id,
                    status: TriggerQueueStatus.PENDING,
                    scheduleAt: new Date(),
                    parentCacheTriggerEventQueueId: cacheTriggerEventQueue.id,
                    payload: updatedCacheQueue.payload
                },
            });

            console.info('Trigger event queue id: ', triggerEventQueue.id);
        }

        await this.prisma.cacheTriggerEventQueue.update({
            where: { id: cacheTriggerEventQueue.id },
            data: { status: TriggerQueueStatus.COMPLETED },
        });


        // Log the execution on trigger event execution log table
        await this.triggerExecutionLogService.eventExecutionLog({
            triggerId: cacheTriggerEventQueue.triggerId,
            agencyId: cacheTriggerEventQueue.agencyId,
            contactId: cacheTriggerEventQueue.contactId,
            userId: cacheTriggerEventQueue.userId,
            eventKey: cacheTriggerEventQueue.triggerEventType as EventKeys,
            status: TriggerEventExecutionLogStatus.SUCCESS,
            executionDate: new Date(),
        })
    }

    /**
     * Processes a single trigger queue entry, validating and executing actions if valid.
     * Updates queue status to PROCESSING, then COMPLETED or FAILED based on outcome.
     * @param cacheTriggerEventQueue - The queue entry to process
     */
    async processRealTimeTriggerQueue(cacheTriggerEventQueue: CacheTriggerEventQueue) {
        console.info('Processing trigger queue: ', cacheTriggerEventQueue.id);

        if (!cacheTriggerEventQueue.triggerEventConfigId) {
            await this.processWithTriggerEventType(cacheTriggerEventQueue);
            return;
        }

        await this.prisma.cacheTriggerEventQueue.update({
            where: { id: cacheTriggerEventQueue.id },
            data: { status: TriggerQueueStatus.PROCESSING },
        });

        const triggerEventConfig = await this.prisma.triggerEventConfig.findFirst({
            where: { id: cacheTriggerEventQueue.triggerEventConfigId },
            include: { event: { select: { key: true } } },
        });

        if (!triggerEventConfig) {
            this.logger.error(`No trigger event config found for ID ${cacheTriggerEventQueue.triggerEventConfigId}`);
            await this.prisma.cacheTriggerEventQueue.update({
                where: { id: cacheTriggerEventQueue.id },
                data: { status: TriggerQueueStatus.FAILED, failReason: 'No trigger event config found' },
            });

            // Log the execution on trigger event execution log table
            await this.triggerExecutionLogService.eventExecutionLog({
                triggerId: cacheTriggerEventQueue.triggerId,
                agencyId: cacheTriggerEventQueue.agencyId,
                contactId: cacheTriggerEventQueue.contactId,
                userId: cacheTriggerEventQueue.userId,
                eventKey: cacheTriggerEventQueue.triggerEventType as EventKeys,
                status: TriggerEventExecutionLogStatus.FAILED,
                error: 'No trigger event config found',
                executionDate: new Date(),
            })
            return;
        }

        console.info('Trigger event config: ', triggerEventConfig);

        const filters = Array.isArray(triggerEventConfig.filters)
            ? (triggerEventConfig.filters as unknown as FilterConditionDto[])
            : [];

        console.info('Filters: ', filters);

        const eventKey = triggerEventConfig.event.key;
        console.info('eventKey: ', eventKey);

        const isValid = await this.isValidToExecute(cacheTriggerEventQueue, eventKey, filters);
        console.info('Is valid to execute: ', isValid);

        if (isValid?.success) {
            const triggerActionConfigs = await this.prisma.triggerActionConfig.findMany({
                where: {
                    agencyId: cacheTriggerEventQueue.agencyId,
                    userId: cacheTriggerEventQueue.userId,
                    triggerEventConfigId: cacheTriggerEventQueue.triggerEventConfigId,
                },
                include: { triggerAction: true },
            });

            console.info('triggerActionConfigs: ', triggerActionConfigs.length);

            for (const triggerActionConfig of triggerActionConfigs) {
                console.info('Action config: ', triggerActionConfig);
                await this.executeTriggerAction(cacheTriggerEventQueue, triggerActionConfig.triggerAction, triggerActionConfig);
            }

            await this.prisma.cacheTriggerEventQueue.update({
                where: { id: cacheTriggerEventQueue.id },
                data: { status: TriggerQueueStatus.COMPLETED },
            });
        } else {
            await this.prisma.cacheTriggerEventQueue.update({
                where: { id: cacheTriggerEventQueue.id },
                data: { status: TriggerQueueStatus.FAILED, failReason: `Validation failed:${isValid.errorMessage}` },
            });

            // Log the execution on trigger event execution log table
            await this.triggerExecutionLogService.eventExecutionLog({
                triggerId: cacheTriggerEventQueue.triggerId,
                agencyId: cacheTriggerEventQueue.agencyId,
                contactId: cacheTriggerEventQueue.contactId,
                userId: cacheTriggerEventQueue.userId,
                eventKey: cacheTriggerEventQueue.triggerEventType as EventKeys,
                error: `Validation failed:${isValid.errorMessage}`,
                status: TriggerEventExecutionLogStatus.FAILED,
                executionDate: new Date(),
            })
        }
    }

    /**
     * @Executes a trigger action, creating an action queue entry and logging the execution.
     * @param cacheTriggerEventQueue - The parent trigger queue
     * @param triggerAction - The action to execute
     * @param triggerActionConfig - Configuration for the action
     */
    async executeTriggerAction(
        cacheTriggerEventQueue: CacheTriggerEventQueue,
        triggerAction: TriggerAction,
        triggerActionConfig: TriggerActionConfig,
    ) {
        console.info('Executing trigger action: ', triggerAction.key);
        let success = true;
        let errorMessage = null;
        try{
            const cacheTriggerEventActionQueue = await this.prisma.cacheTriggerEventActionQueue.create({
                data: {
                    userId: cacheTriggerEventQueue.userId,
                    contactId: cacheTriggerEventQueue.contactId,
                    agencyId: cacheTriggerEventQueue.agencyId,
                    triggerEventType: cacheTriggerEventQueue.triggerEventType,
                    triggerEventId: cacheTriggerEventQueue.triggerEventId,
                    triggerId: cacheTriggerEventQueue.triggerId,
                    triggerEventConfigId: cacheTriggerEventQueue.triggerEventConfigId,
                    triggerActionType: triggerAction.key,
                    triggerActionId: triggerAction.id,
                    triggerActionConfigId: triggerActionConfig.id,
                    status: TriggerQueueStatus.PENDING,
                    payload: cacheTriggerEventQueue?.payload,
                },
            });

        console.info('cacheTriggerEventActionQueue: ', cacheTriggerEventActionQueue.id);
        } catch (error){
          success = false;
          errorMessage =`Failed to create action queue for actionType: ${triggerAction.key} `;
        }

        const triggerEventExecutionLog = await this.prisma.triggerEventExecutionLog.create({
            data: {
                agencyId: cacheTriggerEventQueue.agencyId,
                userId: cacheTriggerEventQueue.userId,
                triggerId: cacheTriggerEventQueue.triggerId,
                triggerEventId: cacheTriggerEventQueue.triggerEventId,
                triggerEventConfigId: cacheTriggerEventQueue.triggerEventConfigId,
                contactId: cacheTriggerEventQueue.contactId,
                status: success ? TriggerEventExecutionLogStatus.SUCCESS : TriggerEventExecutionLogStatus.FAILED,
                error: errorMessage,
                executedAt: new Date(),
            },
        });
        console.info('triggerEventExecutionLog: ', triggerEventExecutionLog.id);
    }

    /**
     * Validates if a trigger queue is eligible to execute by delegating to TriggerValidatorService.
     * @param cacheTriggerEventQueue - The trigger queue entry
     * @param eventKey - The event type key (e.g., BIRTHDAY, KEYWORD)
     * @param filters - Array of filter conditions to validate
     * @returns Promise<boolean> - True if valid, false otherwise
     */
    async isValidToExecute(
        cacheTriggerEventQueue: CacheTriggerEventQueue,
        eventKey: string,
        filters: FilterConditionDto[],
    ): Promise<{ success: boolean, errorMessage: string }> {
        return await this.triggerValidator.validateTrigger(cacheTriggerEventQueue, eventKey, filters);
    }
}