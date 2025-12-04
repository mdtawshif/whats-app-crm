import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { BaseActionExecutor } from './base.action.executor';
import { TriggerExecutionLogService } from '../trigger-execution-log.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import { TriggerActionConfig, TriggerEventConfig, TriggerAction, TriggerEvent, TriggerEventExecutionLogStatus, type Contact, UserStatus } from '@prisma/client';

import { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { ActionKeys, EventKeys } from 'src/types/triggers';
import { plainToInstance } from 'class-transformer';
import { ContactTagActionDto } from '../../dto/process-trigger.dto';
import type { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { TriggerUtils } from '../../utils/trigger.utils';
import { TriggerEventManager } from '../trigger-event-manager/trigger-event-manager.service';
import { TriggerTagService } from '../individual/trigger-tag.service'; // Import the new service
import { TRIGGER_FILTER_FIELDS } from '../../constants/trigger.constant';

import { UserService } from 'src/modules/user/user.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';
@Injectable()
export class AddTagToContactActionExecutor extends BaseActionExecutor {
    constructor(
        protected readonly prisma: PrismaService,
        protected readonly triggerExecutionLogService: TriggerExecutionLogService,
        protected readonly notificationService: NotificationService,
        private readonly triggerEventManager: TriggerEventManager,
        private readonly triggerTagService: TriggerTagService, // Inject the new service
        private readonly userService: UserService,
        logger: PinoLogger) {
        super(prisma, triggerExecutionLogService, notificationService, logger);
        this.logger.setContext(AddTagToContactActionExecutor.name);
    }

    async executeAction(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
        triggerActionConfig: TriggerActionConfig,
        triggerEventConfig: TriggerEventConfig,
        triggerAction: TriggerAction,
        triggerEvent: TriggerEvent,
        skipNotification: boolean = false): Promise<TriggerExecutionResult> {
        this.logger.info('Executing add tag to contact', { queueId: cacheTriggerEventActionQueue.id });

        try {
            const configs = triggerActionConfig.configs;
            const actionConfigDtos = plainToInstance(ContactTagActionDto, configs);
            const parsedPayload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventActionQueue.payload, this.logger);

            if (!Object.keys(parsedPayload).length) {
                return this.createResult(false, 'Action queue payload is empty. ');
            }

            const user: BasicUser = await this.userService.findBasicUserById(cacheTriggerEventActionQueue.userId);
            if (!user || user.status !== UserStatus.ACTIVE) {
                return this.createResult(false, 'User is not found or not active');
            }

            // Use TriggerTagService to process tag additions
            const result = await this.triggerTagService.processAddTagsOperation(
                cacheTriggerEventActionQueue,
                actionConfigDtos.tagIds,
                user,
            );

            // Log execution based on result
            await this.logExecution(
                cacheTriggerEventActionQueue,
                result.success ? TriggerEventExecutionLogStatus.SUCCESS : TriggerEventExecutionLogStatus.FAILED,
                result.message,
            );

            // Create CONTACT_TAG trigger events for each new contact-tag pair
            if (result.success) {
                for (const tagId of actionConfigDtos.tagIds) {
                    await this.triggerEventManager.createTriggerEventQueue({
                        agencyId: cacheTriggerEventActionQueue.agencyId,
                        userId: cacheTriggerEventActionQueue.userId,
                        contactId: cacheTriggerEventActionQueue.contactId,
                        eventKey: EventKeys.CONTACT_TAG,
                        payload: {
                            contact: parsedPayload?.contact,
                            tagId: tagId.toString(),
                            action: TRIGGER_FILTER_FIELDS.TAG_ADDED,
                        },
                    });
                }
            }

        return this.createResult(result.success, result.message)

        } catch (error) {
            return this.handleError(
                cacheTriggerEventActionQueue,
                triggerEvent,
                `Failed to execute ${ActionKeys.ADD_TAG_TO_CONTACT}`,
                error,
                ActionKeys.ADD_TAG_TO_CONTACT,
            );
        }
    }
}
