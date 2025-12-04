import { forwardRef, Module } from '@nestjs/common'
import { RedisModule } from '../redis/redis.module'
import { PrismaService } from 'nestjs-prisma'
import { HttpModule, HttpService } from '@nestjs/axios'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BroadcastController } from './broadcast.controller'
import { BroadcastService } from './broadcast.service'
import { ContactEntryScheduler } from './contact-entry/contact.entry.scheduler'
import { ContactEntryQueueProcessor } from './contact-entry/contact.entry.queue.processor'
import { ConcurrencyLimiter } from './concurrency.limiter'
import { ContactEntryWorker } from './contact-entry/contact.entry.worker'
import { BroadcastContactRepository } from './repository/broadcast.contact.repository';
import { SegmentContactRepository } from '../segment/segment.contact.repository';
import { ContactTagService } from '../tag/contact.tag.service';
import { ContactImportQueueContactRepository } from '../contacts/contact.import.queue.contact.repository';
import { BroadcastScheduler } from './broadcast-scheduler/broadcast.scheduler'
import { BroadcastSchedulerWorker } from './broadcast-scheduler/broadcast.scheduler.worker'
import { BroadcastPauseScheduler } from './broadcast-scheduler/broadcast.pause.scheduler'
import { BroadcastSchedulerService } from './broadcast-scheduler/broadcast.scheduler.service'
import { BroadcastPauseResumeRequestRepository } from './repository/broadcast.pause.resume.request.repository'
import { BroadcastMessageQueueRepository } from './repository/broadcast.message.queue.repository'
import { BroadcastResumeScheduler } from './broadcast-scheduler/broadcast.resume.scheduler'
import { ContactHelperService } from './contact-helper/contact.helper.service'
import { ContactHelperWorker } from './contact-helper/contact.helper.worker'
import { ContactPauseHelper } from './contact-helper/contact.pause.helper'
import { ContactHelperScheduler } from './contact-helper/contact.helper.scheduler'
import { ContactOptoutHelper } from './contact-helper/contact.optout.helper'
import { OptOutService } from '../opt-out/opt-out.service'
import { ContactPauseResumeRequestRepository } from './repository/contact.pause.resume.repository'
import { ContactResumeHelper } from './contact-helper/contact.resume.helper'
import { BroadcastHelperService } from './broadcast.helper.service'
import { UserService } from '../user/user.service'
import { BroadcastMessageLogRepository } from './repository/broadcast.message.log.repository'
import { BroadcastRepository } from './repository/broadcast.repository'
import { EmailService } from '../email/email.service'
import { BroadcastSettingRepository } from './repository/broadcast.setting.repository'
import { FirstSettingSchdeulerService } from './broadcast.scheduler.service/first.setting.scheduler.service'
import { RecurringSettingSchedulerService } from './broadcast.scheduler.service/recurring.setting.scheduler.service'
import { ScheduleTimeCalculationService } from './broadcast.scheduler.service/scheduletime.calculator.service'
import { ContactUnsubHelper } from './contact-helper/contact.unsub.helper'
import { BroadcastSequencesController } from './broadcast.sequence.controller';
import { BroadcastContactsController } from './broadcast.contact.controller';
import { BroadcastSettingsPriorityService } from './service/broadcast-settings-priority.service';
import { ContactEntrySchedulerService } from './contact-entry/contact.entry.scheduler.service'
import { ContactEntryAddHelper } from './contact-entry/contact.entry.add.helper'
import { ContactEntryHelperService } from './contact-entry/contact.entry.helper.service'
import { BroadcastContactEntryQueueRepository } from './repository/broadcast.contact.entry.queue.repository'
import { GmailImportedContactRepository } from './repository/gmail.imported.contact.repository'
import { ContactRepository } from './repository/contact.repository'
import { ContactForwardSchedulerWorker } from './contact-forward-scheduler/contact.forward.scheduler.worker'
import { ContactForwardQueueScheduler } from './contact-forward-scheduler/contact.forward.queue.scheduler'
import { ContactForwardSchedulerHelperService } from './contact-forward-scheduler/forward.scheduler.helper.service'
import { ContactForwardScheduler } from './contact-forward-scheduler/contact.forward.scheduler'
import { ContactForwardQueueRepository } from './repository/contact.forward.queue.repository'
import { BroadcastSenderScheduler } from './broadcast-sender/broadcast.sender.scheduler'
import { BroadcastSendMessageQeueueWorker } from './broadcast-sender/broadcast.send.workder'
import { BroadcastSendHelperService } from './broadcast-sender/broadcast.send.helperService'
import { SandboxMessageSender } from './broadcast-sender/sandbox.message.sender'
import { BroadcastSendValidator } from './broadcast-sender/broadcast.send.validator'
import { BroadcastSender } from './broadcast-sender/broadcast.sender'
import { MessageTemplateService } from '../whatsapp/service/wa.message.template.service'
import { WaBusinessNumberService } from '../whatsapp/service/wa.business.number.service'
import { GatewayCredentialService } from '../gateway-provider/gateway.credential.service'
import { MetaOAuthTokenService } from '../whatsapp/service/meta.oauth.token.service'
import { WaHelperService } from '../whatsapp/service/wa-helper.service'
import { UserSettingRepository } from './repository/user.setting.respository'
import { BroadcastSendLogEntryService } from './broadcast-sender/broadcast.sender.log'
import { FbBusinessAccountService } from '../whatsapp/service/fb.business.account.service'
import { WaBusinessAccountService } from '../whatsapp/service/wa.business.account.service'
import { MessageLogService } from './message-log.service'
import { GatewayCredentialRepository } from './repository/gateway.credential.repository'
import { BroadcastSettingStatsRepository } from './repository/broadcast.setting.stats.repository'
import { TriggerModule } from '../trigger/trigger.module'

@Module({
  imports: [RedisModule, ConfigModule, HttpModule, forwardRef(() => TriggerModule)],
  controllers: [BroadcastController, BroadcastSequencesController, BroadcastContactsController],
  providers: [
    BroadcastService,
    BroadcastRepository,
    BroadcastContactRepository,
    SegmentContactRepository,
    ContactTagService,
    ContactImportQueueContactRepository,
    PrismaService,
    BroadcastPauseResumeRequestRepository,
    BroadcastHelperService,
    BroadcastSettingsPriorityService,
    {
      provide: ConcurrencyLimiter,
      useFactory: () => new ConcurrencyLimiter(5) // set maxConcurrent here
    },
    /**
     broadcast scheduler [pause/resume]
    */
    BroadcastScheduler,
    BroadcastSchedulerWorker,
    BroadcastPauseScheduler,
    BroadcastSchedulerService,
    BroadcastMessageQueueRepository,
    BroadcastResumeScheduler,
    UserService,
    BroadcastMessageLogRepository,
    /*
    * contactHelper
    */
    ContactHelperScheduler,
    ContactHelperWorker,
    ContactPauseHelper,
    ContactOptoutHelper,
    ContactHelperService,
    OptOutService,
    ContactPauseResumeRequestRepository,
    ContactResumeHelper,
    EmailService,
    BroadcastHelperService,
    BroadcastSettingRepository,
    FirstSettingSchdeulerService,
    RecurringSettingSchedulerService,
    ScheduleTimeCalculationService,
    ContactUnsubHelper,

    /*
    * contact-entry-helper
    */
    ContactEntryScheduler,
    ContactEntryWorker,
    ContactEntryAddHelper,
    ContactEntryHelperService,
    ContactEntrySchedulerService,
    BroadcastContactEntryQueueRepository,
    GmailImportedContactRepository,
    ContactRepository,

    /**
     * contact forward scheduler
     */
    ContactForwardQueueScheduler,
    ContactForwardSchedulerWorker,
    ContactForwardSchedulerHelperService,
    ContactForwardScheduler,
    ContactForwardQueueRepository,

    /**
     * broadcast sender
     */
    BroadcastSenderScheduler,
    BroadcastSendMessageQeueueWorker,
    BroadcastSendHelperService,
    SandboxMessageSender,
    BroadcastSendValidator,
    BroadcastSender,
    MessageTemplateService,
    WaBusinessNumberService,
    GatewayCredentialService,
    MetaOAuthTokenService,
    WaHelperService,
    UserSettingRepository,
    BroadcastSendLogEntryService,
    FbBusinessAccountService,
    WaBusinessAccountService,
    MessageLogService,
    GatewayCredentialRepository,
    BroadcastSettingStatsRepository

  ],

  exports: [BroadcastService, BroadcastSendLogEntryService, BroadcastSendHelperService, MessageLogService, BroadcastSender]
})
export class BroadcastModule { }
