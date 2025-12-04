import { forwardRef, Module } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { BullModule } from '@nestjs/bullmq';

// Controllers
import { TriggerController } from './controllers/trigger.controller';

// Services
//* Core services
import { TriggerService } from './services/core/trigger.service';
import { TriggerEventService } from './services/core/trigger-event.service';
import { TriggerActionService } from './services/core/trigger-action.service';


// Filter Handler
import { TagModule } from '../tag/tag.module';
import { ContactModule } from '../contacts/contact.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { InboxThreadModule } from '../inbox-thread/inbox-thread.module';
import { ConversationModule } from '../conversation/conversation.module';
import { TriggerExecutionLogService } from './services/trigger-execution-log.service';
import { TriggerBroadcastService } from './services/individual/trigger-broadcast.service';
import { OptOutModule } from '../opt-out/opt-out.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { RealtimeTriggerProcessService } from './services/realtime.trigger.process.service';
import { CronTriggerProcessService } from './services/cron.trigger.process.service';
import { TriggerEventManager } from './services/trigger-event-manager/trigger-event-manager.service';
import { TriggerValidatorService } from './services/trigger-validator.service';
import { TriggerOptOutService } from './services/individual/trigger-optout.service';
import { TriggerTagService } from './services/individual/trigger-tag.service';
import { TriggerActivityLogService } from './services/trigger.activitylog.service';


@Module({
  imports: [
    BullModule.registerQueue({
      name: 'trigger-queue',
    }),
    TagModule, // Import TagModule to provide TagService
    NotificationsModule, // Use forwardRef to handle potential circular dependencies with NotificationsModule,
    OptOutModule,
    BroadcastModule,
    forwardRef(() => ContactModule), // Use forwardRef to handle potential circular dependencies
    forwardRef(() => WhatsAppModule),
    forwardRef(() => InboxThreadModule),
    forwardRef(() => ConversationModule),
  ],
  providers: [
    PrismaService,

    //Core services
    TriggerService,
    TriggerEventService,
    TriggerActionService,

    //Cron services
    CronTriggerProcessService,

    //processors
    RealtimeTriggerProcessService,
    //validator
    TriggerValidatorService,
    //individual services
    TriggerBroadcastService,
    TriggerOptOutService,
    TriggerTagService,

    //event manager
    TriggerEventManager,


    //execution logs services
    TriggerExecutionLogService,
    TriggerActivityLogService
  ],
  controllers: [
    TriggerController,
  ],
  exports: [
    // Core services
    TriggerService,
    TriggerEventService,
    TriggerActionService,

    //individual services
    TriggerBroadcastService,
    TriggerOptOutService,
    TriggerTagService,

    //processors
    RealtimeTriggerProcessService,
    //validator
    TriggerValidatorService,
    //event manager
    TriggerEventManager,


    //execution logs services
    TriggerExecutionLogService,
    TriggerActivityLogService

  ],
})
export class TriggerModule { }