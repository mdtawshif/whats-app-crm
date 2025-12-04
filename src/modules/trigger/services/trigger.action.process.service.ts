import { Injectable } from '@nestjs/common';
import { CacheTriggerEventQueue, TriggerAction, TriggerActionConfig, TriggerQueueStatus, TriggerEventExecutionLogStatus, CacheTriggerEventActionQueue, NotificationType } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { FilterConditionDto } from '../dto/process-trigger.dto';
import { ActionKeys, type EventKeys } from '../../../types/triggers/index';
import { AddTagToContactActionExecutor } from './trigger-action-executors/add-tag-to-contact.action.executor';
import { SendWhatsAppActionExecutor } from './trigger-action-executors/send-whatsapp-message.action.executor';
import { OptOutContactActionExecutor } from './trigger-action-executors/optout-contact.action.executor';
import { PauseBroadcastActionExecutor } from './trigger-action-executors/pause-broadcast.action.executor';
import { UnsubscribeBroadcastActionExecutor } from './trigger-action-executors/unsubscribe-broadcast.action.executor';
import { PauseFromAllBroadcastActionExecutor } from './trigger-action-executors/pause-from-all-broadcast.executor';
import { UnsubscribeFromAllBroadcastActionExecutor } from './trigger-action-executors/unsubscribe-from-all-broadcast.executor';
import { NotificationService } from '../../notifications/notifications.service';
import type { TriggerExecutionResult } from '../interfaces/trigger.interface';
import { normalizeString, normalizeText } from '@/utils/utils';
import { AddContactToBroadcastActionExecutor } from './trigger-action-executors/add-contact-to-broadcast.action.executor';
import { TriggerUtils } from '../utils/trigger.utils';

@Injectable()
export class TriggerActionProcessService {
  private readonly actionExecutors: Record<ActionKeys, any>

  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService, // Add NotificationService
    private readonly AddTagToContactActionExecutor: AddTagToContactActionExecutor,
    private readonly sendWhatsAppActionExecutor: SendWhatsAppActionExecutor,
    private readonly optOutContactActionExecutor: OptOutContactActionExecutor,
    private readonly pauseBroadcastActionExecutor: PauseBroadcastActionExecutor,
    private readonly unsubscribeBroadcastActionExecutor: UnsubscribeBroadcastActionExecutor,
    private readonly unsubscribeFromAllBroadcastActionExecutor: UnsubscribeFromAllBroadcastActionExecutor,
    private readonly pauseFromAllBroadcastActionExecutor: PauseFromAllBroadcastActionExecutor,
    private readonly addContactToBroadcastActionExecutor: AddContactToBroadcastActionExecutor
  ) {
    this.logger.setContext(this.constructor.name)
    this.actionExecutors = {
      [ActionKeys.ADD_TAG_TO_CONTACT]: this.AddTagToContactActionExecutor,
      [ActionKeys.SEND_WHATSAPP_MESSAGE]: this.sendWhatsAppActionExecutor,
      [ActionKeys.OPTOUT_CONTACT]: this.optOutContactActionExecutor,
      [ActionKeys.PAUSE_BROADCAST]: this.pauseBroadcastActionExecutor,
      [ActionKeys.UNSUBSCRIBE_BROADCAST]: this.unsubscribeBroadcastActionExecutor,
      [ActionKeys.PAUSE_FROM_ALL_BROADCAST]: this.pauseFromAllBroadcastActionExecutor,
      [ActionKeys.UNSUBSCRIBE_FROM_ALL_BROADCAST]: this.unsubscribeFromAllBroadcastActionExecutor,
      [ActionKeys.ADD_CONTACT_TO_BROADCAST]: this.addContactToBroadcastActionExecutor
    }
  }

  async processTriggerAction() {
    this.logger.info('Trigger Action Process Service Started')

    const cacheTriggerEventActionQueues = await this.prisma.cacheTriggerEventActionQueue.findMany({
      where: {
        status: TriggerQueueStatus.PENDING,
        scheduleAt: {
          lte: new Date()
        }
      },
      take: 100
    })

    this.logger.info(
      `Pending trigger action event queues: ${cacheTriggerEventActionQueues.length}`
    )

    // for (const cacheTriggerEventActionQueue of cacheTriggerEventActionQueues) {
    //   await this.processTriggerActionQueue(cacheTriggerEventActionQueue)
    // }

    // Group queues by triggerEventId and userId
    const groupedQueues = cacheTriggerEventActionQueues.reduce((acc, queue) => {
      const key = `${queue.triggerEventId}_${queue.agencyId}_${queue.userId}`;
      if (!acc[key]) {
        acc[key] = {
          triggerEventId: queue.triggerEventId,
          userId: queue.userId,
          agencyId: queue.agencyId,
          eventKey: queue.triggerEventType as EventKeys,
          queues: [],
        };
      }
      acc[key].queues.push(queue);
      return acc;
    }, {} as Record<string, { triggerEventId: bigint; userId: bigint; agencyId: bigint; eventKey: EventKeys; queues: CacheTriggerEventActionQueue[] }>);

    for (const group of Object.values(groupedQueues)) {
      await this.processGroupedQueues(group);
    }
  }


  private async processGroupedQueues(group: { triggerEventId: bigint; userId: bigint; agencyId: bigint; eventKey: EventKeys; queues: CacheTriggerEventActionQueue[] }) {
    const { triggerEventId, userId, agencyId, eventKey, queues } = group;
    this.logger.info(`Processing ${queues.length} queues for event ${eventKey} and user ${userId}`);

    const results: TriggerExecutionResult[] = [];
    const BATCH_THRESHOLD = 2; // Batch notifications if 2 or more queues

    const shouldSendBatchedNotification = queues.length >= BATCH_THRESHOLD;

    for (const queue of queues) {
      //shouldSendBatchedNotification now allowing single notification per queue and action
      const result = await this.processTriggerActionQueue(queue, false); // shouldSendBatchedNotification  false for now add later to bulk notification
      results.push(result);
    }

    // Send batched notification if there are multiple queues

    //hide for now
    // if (shouldSendBatchedNotification) {
    //   await this.sendBatchedNotification(userId, agencyId, eventKey, results, queues.length);
    // }
  }

  /**
   * @Process trigger event action
   * @param cacheTriggerEventActionQueue
   * @returns
   */
  private async processTriggerActionQueue(cacheTriggerEventActionQueue: CacheTriggerEventActionQueue, skipIndividualNotification: boolean = false): Promise<TriggerExecutionResult> {
    this.logger.info('Processing trigger queue: ', cacheTriggerEventActionQueue.id);

    try {
      // Mark queue as processing
      await this.prisma.cacheTriggerEventActionQueue.update({
        where: { id: cacheTriggerEventActionQueue.id },
        data: { status: TriggerQueueStatus.PROCESSING },
      });

      const triggerActionConfig = await this.prisma.triggerActionConfig.findFirst({
        where: { id: cacheTriggerEventActionQueue.triggerActionConfigId },
        include: {
          triggerEventConfig: true,
          triggerAction: true,
          triggerEvent: true
        }
      })

      if (!triggerActionConfig) {
        await this.changeStatus(cacheTriggerEventActionQueue.id, false, { failedReason: 'Trigger action config not found' })
        return
      }

      const { triggerEventConfig, triggerAction, triggerEvent } = triggerActionConfig;
      this.logger.info('Trigger event config: ', triggerEventConfig);
      this.logger.info('Trigger action: ', triggerAction);
      this.logger.info('Trigger event: ', triggerEvent);

      const filters = Array.isArray(triggerEventConfig.filters) ? (triggerEventConfig.filters as unknown as FilterConditionDto[]) : [];
      this.logger.info('Filters: ', filters);

      const actionKey = triggerAction.key as ActionKeys;
      this.logger.info('Action Key: ', actionKey);

      const executor = this.actionExecutors[actionKey]
      if (!executor) {
        this.logger.warn(`No executor found for action: ${actionKey}`);
        await this.changeStatus(cacheTriggerEventActionQueue.id, false, { failedReason: `No executor found for action: ${actionKey}` });
        return this.createResult(false, `No executor found for action: ${actionKey}`, `No executor found for action: ${actionKey}`);
      }

      // Execute action, passing skipNotification flag
      const result = await executor.executeAction(
        cacheTriggerEventActionQueue,
        triggerActionConfig,
        triggerEventConfig,
        triggerAction,
        triggerEvent,
        skipIndividualNotification,
      );

      // Update queue status
      await this.changeStatus(cacheTriggerEventActionQueue.id, result?.success, { failReason: result.error || '' });

      return { ...result, actionKey: actionKey };
    } catch (error) {
      this.logger.error(`Failed to process queue ${cacheTriggerEventActionQueue.id}: ${error.message}`);
      await this.prisma.cacheTriggerEventActionQueue.update({
        where: { id: cacheTriggerEventActionQueue.id },
        data: { status: TriggerQueueStatus.FAILED },
      });
      return this.createResult(false, `Failed to process queue: ${error.message}`, error.message);
    }
  }

  /**
   *  Send batched notification
   * @param userId 
   * @param agencyId 
   * @param eventKey 
   * @param results 
   * @param queueCount 
   */
  private async sendBatchedNotification(
    userId: bigint,
    agencyId: bigint,
    eventKey: EventKeys,
    results: TriggerExecutionResult[],
    queueCount: number,
  ) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const success = successCount > 0;

    // Deduplicate actionKeys
    const uniqueActionKeys = [
      ...new Set(
        results
          .map(
            (r: TriggerExecutionResult & { actionKey?: ActionKeys }) =>
              r?.actionKey
          )
          .filter(Boolean)
      ),
    ]

    const normalizedActions = uniqueActionKeys.map(TriggerUtils.normalizeActionKey).slice(0, 5);
    const actionKeyList = normalizedActions.join(", ")

    const normalizedEvent = normalizeText(eventKey);
    const title = success
      ? `${normalizedEvent} processed ${queueCount} action${queueCount > 1 ? 's' : ''} for ${actionKeyList}!`
      : `${normalizedEvent} failed for ${queueCount} action${queueCount > 1 ? 's' : ''} (${actionKeyList})`;

    let message = `Processed ${queueCount} action${queueCount > 1 ? 's' : ''} for ${normalizedEvent}. Success: ${successCount}, Failed: ${failureCount}.`;

    if (queueCount > 2) {
      message += ` Completed ${successCount} successfully${failureCount > 0 ? ` and ${failureCount} failed.` : '.'}`;
    }

    try {
      await this.notificationService.sendToUser(
        userId,
        agencyId,
        NotificationType.TRIGGER_ALERT,
        {
          title,
          message,
          navigatePath: '/contacts',
          data: { navigatePath: '/contacts' },
        },
      );

      this.logger.info(
        `Sent batched notification: ${queueCount} queue(s), event=${eventKey}, user=${userId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send batched notification: ${error.message}`);
    }
  }


  /**
   * @Execute trigger action
   * @param cacheTriggerEventQueue
   * @param triggerAction
   * @param triggerActionConfig
   */
  async executeTriggerAction(
    cacheTriggerEventQueue: CacheTriggerEventQueue,
    triggerAction: TriggerAction,
    triggerActionConfig: TriggerActionConfig
  ) {
    this.logger.info('Executing trigger action: ', triggerAction)
    this.logger.info('Trigger action config: ', triggerActionConfig)

    const cacheTriggerEventActionQueue =
      await this.prisma.cacheTriggerEventActionQueue.create({
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
          payload: cacheTriggerEventQueue?.payload
        }
      })

    this.logger.info(
      'Created cacheTriggerEventActionQueue: ',
      cacheTriggerEventActionQueue
    )

    const triggerEventExecutionLog =
      await this.prisma.triggerEventExecutionLog.create({
        data: {
          agencyId: cacheTriggerEventQueue.agencyId,
          userId: cacheTriggerEventQueue.userId,
          triggerId: cacheTriggerEventQueue.triggerId,
          triggerEventId: cacheTriggerEventQueue.triggerEventId,
          triggerEventConfigId: cacheTriggerEventQueue.triggerEventConfigId,
          contactId: cacheTriggerEventQueue.contactId,
          status: TriggerEventExecutionLogStatus.SUCCESS,
          error: null,
          executedAt: new Date()
        }
      })

    this.logger.info(
      'Created triggerEventExecutionLog: ',
      triggerEventExecutionLog
    )
  }

  /**
   * @change status based on successs
   * @param id 
   * @param success 
   * @param data 
   */
  private async changeStatus(id: bigint, success: boolean, data: any) {
    data = {
      ...data,
      status: success ? TriggerQueueStatus.COMPLETED : TriggerQueueStatus.FAILED
    }
    await this.prisma.cacheTriggerEventActionQueue.update({
      where: { id: id },
      data: data,
    })
  }

  /**
   *  Create result
   * @param success 
   * @param message 
   * @param error 
   * @param duration 
   * @returns 
   */

  private createResult(
    success: boolean,
    message: string,
    error?: string,
    duration: number = 0,
  ): TriggerExecutionResult {
    return { success, message };
  }

}