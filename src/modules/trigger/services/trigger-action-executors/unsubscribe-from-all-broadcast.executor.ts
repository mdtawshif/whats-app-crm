import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { BaseActionExecutor } from './base.action.executor';
import { TriggerExecutionLogService } from '../trigger-execution-log.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import {
    TriggerActionConfig,
    TriggerEventConfig,
    TriggerEvent,
    TriggerEventExecutionLogStatus,
    type TriggerAction,
    BroadcastContactStatus,
    UserStatus,
} from '@prisma/client';
import { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { ActionKeys } from 'src/types/triggers';
import type { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { TriggerBroadcastService } from '../individual/trigger-broadcast.service';

import { UserService } from 'src/modules/user/user.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';
@Injectable()
export class UnsubscribeFromAllBroadcastActionExecutor extends BaseActionExecutor {
    constructor(
        protected readonly prisma: PrismaService,
        protected readonly triggerExecutionLogService: TriggerExecutionLogService,
        protected readonly notificationService: NotificationService,
        private readonly triggerBroadcastService: TriggerBroadcastService,
        private readonly userService: UserService,
        logger: PinoLogger,
    ) {
        super(prisma, triggerExecutionLogService, notificationService, logger);
        this.logger.setContext(UnsubscribeFromAllBroadcastActionExecutor.name);
    }

    async executeAction(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
        triggerActionConfig: TriggerActionConfig, // No extra configs needed
        triggerEventConfig: TriggerEventConfig,
        triggerAction: TriggerAction,
        triggerEvent: TriggerEvent,
        skipNotification: boolean = false
    ): Promise<TriggerExecutionResult> {
        
        this.logger.info('Executing unsubscribe from all broadcasts', { queueId: cacheTriggerEventActionQueue.id });

        try {
            const user: BasicUser = await this.userService.findBasicUserById(cacheTriggerEventActionQueue.userId);
            if (!user || user.status !== UserStatus.ACTIVE) {
                return this.createResult(false, 'User is not found or not active');
            }

            const result = await this.triggerBroadcastService.pauseOrUnsubContactFromAllBroadcasts(
                BroadcastContactStatus.UNSUBSCRIBE,
                user,
                cacheTriggerEventActionQueue
            );

            await this.logExecution(cacheTriggerEventActionQueue, result.success ? TriggerEventExecutionLogStatus.SUCCESS : TriggerEventExecutionLogStatus.SUCCESS, result.success ? null : result.message,);

            // if (result.success && result.successCount > 0 && !skipNotification) {
            //     const parsedPayload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventActionQueue.payload, this.logger);
            //     await this.sendNotification(
            //         cacheTriggerEventActionQueue,
            //         triggerEvent,
            //         { success: true, message: result?.message },
            //         `${TriggerUtils.normalizeActionKey(cacheTriggerEventActionQueue.triggerEventType)}: Unsubscribed ${getContactDisplayName(parsedPayload?.contact as unknown as Contact) || 'Contact'} from all broadcasts`,
            //         result?.message,
            //         '/broadcasts',
            //     );
            // }

            return this.createResult(result.success, result.message);
        } catch (error) {
            return this.handleError(cacheTriggerEventActionQueue, triggerEvent, `Failed to execute ${ActionKeys.UNSUBSCRIBE_FROM_ALL_BROADCAST}`, error,  ActionKeys.UNSUBSCRIBE_FROM_ALL_BROADCAST);
        }
    }
}