import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import { TriggerExecutionLogService } from '../trigger-execution-log.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { CacheTriggerEventActionQueue, TriggerActionConfig, TriggerEventConfig, TriggerAction, TriggerEvent, TriggerEventExecutionLogStatus, NotificationType, UserStatus } from '@prisma/client';
import { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { ActionKeys, EventKeys } from 'src/types/triggers';
import { normalizeText } from '@/utils/utils';
import type { BasicUser } from 'src/modules/user/dto/user.dto';

@Injectable()
export abstract class BaseActionExecutor {
    protected readonly logger: PinoLogger;

    constructor(
        protected readonly prisma: PrismaService,
        protected readonly triggerExecutionLogService: TriggerExecutionLogService,
        protected readonly notificationService: NotificationService,
        logger: PinoLogger,
    ) {
        this.logger = logger;
        this.logger.setContext(this.constructor.name);
    }

    /**
     * Abstract method for core action logic.
     */
    abstract executeAction(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueue,
        triggerActionConfig: TriggerActionConfig,
        triggerEventConfig: TriggerEventConfig,
        triggerAction: TriggerAction,
        triggerEvent: TriggerEvent,
    ): Promise<TriggerExecutionResult>;


    /**
     * Validate user exists and is active.
     * Throws error if user does not exist or is inactive.
     */
    protected async validateUser({ userId, agencyId }: { userId: bigint, agencyId: bigint }): Promise<BasicUser> {
        return await this.prisma.user.findUnique({
            where: { id: userId, agencyId: agencyId, status: UserStatus.ACTIVE },
            select: { id: true, agencyId: true, parentUserId: true, status: true },
        });
    }

    /**
     * Logs execution, supports single/bulk contacts.
     */
    protected async logExecution(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueue,
        status: TriggerEventExecutionLogStatus,
        error?: string,
        contactIds?: bigint[],
    ): Promise<void> {
        try {
            const baseDto = {
                triggerId: cacheTriggerEventActionQueue.triggerId,
                agencyId: cacheTriggerEventActionQueue.agencyId,
                userId: cacheTriggerEventActionQueue.userId,
                eventKey: cacheTriggerEventActionQueue.triggerEventType as EventKeys,
                actionKey: cacheTriggerEventActionQueue.triggerActionType as ActionKeys,
                status,
                error,
                executionDate: new Date(),
            };

            if (contactIds && contactIds.length > 1) {
                for (const contactId of contactIds) {
                    await this.triggerExecutionLogService.eventActionExecutionLog({ ...baseDto, contactId });
                }
            } else {
                await this.triggerExecutionLogService.eventActionExecutionLog({
                    ...baseDto,
                    contactId: cacheTriggerEventActionQueue.contactId,
                });
            }
        } catch (err) {
            this.logger.error(`Failed to log: ${err.message}`);
        }
    }

    /**
     * Sends notification based on result.
     */
    protected async sendNotification(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueue,
        triggerEvent: TriggerEvent,
        result: TriggerExecutionResult,
        customTitle?: string,
        customMessage?: string,
        navigatePath: string = '/contacts',
        skipNotification: boolean = false, // New flag to skip notifications
    ): Promise<void> {
        if (skipNotification) {
            this.logger.info(`Skipping notification for queue ${cacheTriggerEventActionQueue.id}`);
            return;
        }

        const title = customTitle || this.getDefaultTitle(triggerEvent.key as EventKeys, result.success);
        const message = customMessage || this.getDefaultMessage(result);

        await this.notificationService.sendToUser(
            cacheTriggerEventActionQueue.userId,
            cacheTriggerEventActionQueue.agencyId,
            NotificationType.TRIGGER_ALERT,
            { title, message, navigatePath, data: { navigatePath } },
        );
    }

    protected createResult(
        success: boolean,
        message: string,
    ): TriggerExecutionResult  {
        return { success, message };
    }

    protected handleError(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueue,
        triggerEvent: TriggerEvent,
        message: string,
        error: Error,
        actionKey: ActionKeys,
        contactIds?: bigint[],
    ): TriggerExecutionResult {
        const finalMessage = message || `Failed to execute ${actionKey}`;
        this.logger.error(finalMessage, { error: error.message });

        this.logExecution(cacheTriggerEventActionQueue, TriggerEventExecutionLogStatus.FAILED, error.message, contactIds);
        // this.sendNotification(cacheTriggerEventActionQueue, triggerEvent, { success: false, message: finalMessage, error: error.message, duration });

        return this.createResult(false, finalMessage);
    }

    private getDefaultTitle(event: EventKeys, success: boolean): string {
        return success ? ` ${normalizeText(event)} Success!` : `${normalizeText(event)} Failed`;
    }

    private getDefaultMessage(result: TriggerExecutionResult): string {
        let msg = result.message;
        
        return msg;
    }
}