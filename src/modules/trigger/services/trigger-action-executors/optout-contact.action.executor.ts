import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from 'nestjs-prisma'
import { BaseActionExecutor } from './base.action.executor'
import { TriggerExecutionLogService } from '../trigger-execution-log.service'
import { NotificationService } from 'src/modules/notifications/notifications.service'
import {
    TriggerActionConfig,
    TriggerEventConfig,
    TriggerAction,
    TriggerEvent,
    TriggerEventExecutionLogStatus,
    UserStatus,
    Contact,
    ActivityAction,
    ActivityCategory,
} from '@prisma/client'
import { TriggerExecutionResult } from '../../interfaces/trigger.interface'
import { ActionKeys } from 'src/types/triggers'
import { TriggerOptOutService } from '../individual/trigger-optout.service'
import type { AddOptoutActionExecutorConfig } from 'src/types/triggers/add-optout-action-executor.config.types'
import type { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types'
import { UserService } from 'src/modules/user/user.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';
import { createActivity } from '@/common/helpers/activity-log.helper'
@Injectable()
export class OptOutContactActionExecutor extends BaseActionExecutor {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly triggerExecutionLogService: TriggerExecutionLogService,
    protected readonly notificationService: NotificationService,
    private readonly triggerOptOutService: TriggerOptOutService,
    private readonly userService: UserService,
    logger: PinoLogger
  ) {
    super(prisma, triggerExecutionLogService, notificationService, logger)
    this.logger.setContext(OptOutContactActionExecutor.name)
  }

  async executeAction(
    cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
    triggerActionConfig: TriggerActionConfig & {
      configs: AddOptoutActionExecutorConfig
    },
    triggerEventConfig: TriggerEventConfig,
    triggerAction: TriggerAction,
    triggerEvent: TriggerEvent,
    skipNotification: boolean = false // New flag to skip notifications
  ): Promise<TriggerExecutionResult> {
    this.logger.info('Executing opt-out contact', {
      queueId: cacheTriggerEventActionQueue.id
    })

    try {
      const user: BasicUser = await this.userService.findBasicUserById(
        cacheTriggerEventActionQueue.userId
      )
      if (!user || user.status !== UserStatus.ACTIVE) {
        return this.createResult(false, 'User is not found or not active')
      }

      const result = await this.triggerOptOutService.optedOutContact(cacheTriggerEventActionQueue, user)

      await this.logExecution(
        cacheTriggerEventActionQueue,
        result.success
          ? TriggerEventExecutionLogStatus.SUCCESS
          : TriggerEventExecutionLogStatus.FAILED,
        result.message
      )

      return this.createResult(result.success, result.message)
    } catch (error) {
      return this.handleError(
        cacheTriggerEventActionQueue,
        triggerEvent,
        `Failed to execute ${ActionKeys.OPTOUT_CONTACT}`,
        error,
        ActionKeys.OPTOUT_CONTACT
      )
    }
  }
}
