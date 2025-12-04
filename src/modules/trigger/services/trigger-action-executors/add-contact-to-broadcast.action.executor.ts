import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { BaseActionExecutor } from './base.action.executor';
import { TriggerExecutionLogService } from '../trigger-execution-log.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { TriggerActionConfig, TriggerEventConfig, TriggerAction, TriggerEvent, TriggerEventExecutionLogStatus, UserStatus } from '@prisma/client';
import { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { ActionKeys } from 'src/types/triggers';
import { TriggerBroadcastService } from '../individual/trigger-broadcast.service';
import type { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { UserService } from 'src/modules/user/user.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';


@Injectable()
export class AddContactToBroadcastActionExecutor extends BaseActionExecutor {
    constructor(
        protected readonly prisma: PrismaService,
        protected readonly triggerExecutionLogService: TriggerExecutionLogService,
        protected readonly notificationService: NotificationService,
        private readonly triggerBroadcastService: TriggerBroadcastService,
        private readonly userService: UserService,
        logger: PinoLogger,
    ) {
        super(prisma, triggerExecutionLogService, notificationService, logger);
        this.logger.setContext(AddContactToBroadcastActionExecutor.name);
    }

    async executeAction(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
        triggerActionConfig: TriggerActionConfig & {
            configs: { broadcastId: bigint };
        },
        triggerEventConfig: TriggerEventConfig,
        triggerAction: TriggerAction,
        triggerEvent: TriggerEvent,
        skipNotification: boolean = false,
    ): Promise<TriggerExecutionResult> {
        this.logger.info('Executing add contact to broadcast', { queueId: cacheTriggerEventActionQueue.id });

        try {

            const broadcastId = triggerActionConfig.configs?.broadcastId;
            if (!broadcastId) {
                return this.createResult(false, 'BroadcastId Not Provided');
            }

            const user: BasicUser = await this.userService.findBasicUserById(cacheTriggerEventActionQueue.userId);
            if (!user || user.status !== UserStatus.ACTIVE) {
                return this.createResult(false, 'User is not found or not active');
            }

            const result = await this.triggerBroadcastService.addContactToBroadcast(user, cacheTriggerEventActionQueue, broadcastId);

            await this.logExecution(
                cacheTriggerEventActionQueue,
                result.success ? TriggerEventExecutionLogStatus.SUCCESS : TriggerEventExecutionLogStatus.FAILED,
                result.success ? null : result.message
            );

            // if (result.success && !skipNotification) {
            //     const parsedPayload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventActionQueue.payload, this.logger);

            //     await this.sendNotification(
            //         cacheTriggerEventActionQueue,
            //         triggerEvent,
            //         { success: true, message: result.message },
            //         `${TriggerUtils.normalizeActionKey(cacheTriggerEventActionQueue.triggerEventType)}: Contact ${parsedPayload?.contact ? getContactDisplayName(parsedPayload?.contact as unknown as Contact) : ''} Added to Broadcast`,
            //         result.message,
            //         '/broadcasts',
            //         skipNotification,
            //     );
            // }

            return this.createResult(
                result.success,
                result.message,
            );
        } catch (error) {
            return this.handleError(
                cacheTriggerEventActionQueue,
                triggerEvent,
                `Failed to execute ${ActionKeys.ADD_CONTACT_TO_BROADCAST}`,
                error,
                ActionKeys.ADD_CONTACT_TO_BROADCAST,
            );
        }
    }
}