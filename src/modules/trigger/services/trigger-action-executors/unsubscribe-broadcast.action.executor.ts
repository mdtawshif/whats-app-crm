import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { BaseActionExecutor } from './base.action.executor';
import { TriggerExecutionLogService } from '../trigger-execution-log.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { TriggerActionConfig, TriggerEventConfig, TriggerAction, TriggerEvent, TriggerEventExecutionLogStatus, BroadcastContactStatus, UserStatus } from '@prisma/client';
import { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { ActionKeys } from 'src/types/triggers';
import { TriggerBroadcastService } from '../individual/trigger-broadcast.service';
import type { UnsubscribeBroadcastActionExecutorConfig } from 'src/types/triggers/unsubcribe-broadcast-executor.config.types';

import type { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { UserService } from 'src/modules/user/user.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';

@Injectable()
export class UnsubscribeBroadcastActionExecutor extends BaseActionExecutor {
    constructor(
        protected readonly prisma: PrismaService,
        protected readonly triggerExecutionLogService: TriggerExecutionLogService,
        protected readonly notificationService: NotificationService,
        private readonly triggerBroadcastService: TriggerBroadcastService,
        private readonly userService: UserService,
        logger: PinoLogger,
    ) {
        super(prisma, triggerExecutionLogService, notificationService, logger);
        this.logger.setContext(UnsubscribeBroadcastActionExecutor.name);
    }

    async executeAction(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
        triggerActionConfig: TriggerActionConfig & {
            configs: UnsubscribeBroadcastActionExecutorConfig
        },
        triggerEventConfig: TriggerEventConfig,
        triggerAction: TriggerAction,
        triggerEvent: TriggerEvent,
        skipNotification: boolean = false
    ): Promise<TriggerExecutionResult> {

        this.logger.info('Executing unsubscribe broadcast', { queueId: cacheTriggerEventActionQueue.id });

        try {

            const broadcastId = triggerActionConfig.configs?.broadcastId || ""

            if (!broadcastId || broadcastId === "") {
                return this.createResult(false, 'No broadcastIds provided',);
            }

            const user: BasicUser = await this.userService.findBasicUserById(cacheTriggerEventActionQueue.userId);
            if (!user || user.status !== UserStatus.ACTIVE) {
                return this.createResult(false, 'User is not found or not active');
            }

            const result = await this.triggerBroadcastService.pauseOrUnsubContactFromBroadcast(BroadcastContactStatus.UNSUBSCRIBE,
                user,
                cacheTriggerEventActionQueue,
                broadcastId,
            );

            await this.logExecution(cacheTriggerEventActionQueue, result.success ? TriggerEventExecutionLogStatus.SUCCESS : TriggerEventExecutionLogStatus.FAILED, result.success ? null : result.message,);

            // if (result.success  && !skipNotification) {
            //     const parsedPayload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventActionQueue.payload, this.logger);
            //     await this.sendNotification(
            //         cacheTriggerEventActionQueue,
            //         triggerEvent,
            //         { success: true, message: result.message },
            //         `${TriggerUtils.normalizeActionKey(cacheTriggerEventActionQueue.triggerEventType)}: Unsubscribed ${parsedPayload?.contact ? `to ${getContactDisplayName(parsedPayload?.contact as unknown as Contact)}` : ''}  `,
            //         result.message,
            //         '/broadcasts',
            //         skipNotification
            //     );
            // }

            return this.createResult(result.success, result.message);
        } catch (error) {
            return this.handleError(cacheTriggerEventActionQueue, triggerEvent, `Failed to execute ${ActionKeys.UNSUBSCRIBE_BROADCAST}`, error,  ActionKeys.UNSUBSCRIBE_BROADCAST);
        }
    }
}