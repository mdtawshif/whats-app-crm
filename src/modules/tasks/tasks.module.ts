import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { CommonService } from "../common/common.service";

import { BullBoardAuthModule } from "./bull-board/bull-board.module";

import { RedisModule } from "../redis/redis.module";
import { TasksService } from "./tasks.service";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { AutoRechargeProcess } from "./process/auto-recharge.process";
import { PrismaService } from "nestjs-prisma";
import { PaymentModule } from "../payment/payment.module";
import { EmailService } from "../email/email.service";
import { PaymentService } from "../payment/payment.service";
import { CancelSubscriptionProcess } from "./process/cancel-subscription.process";
import { AutoRechargeService } from "../payment/autorecharge.service";
import { StripeWebhookService } from "../payment/stripe.webhook.service";
import { UserService } from "../user/user.service";
import { GA4Service } from "../common/ga4.service";
import { SyncMetaDataProcess } from "./process/sync-meta-data.process";
import { MetaDataSyncJobService } from "../whatsapp/service/metaDataSyncJobs.service";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { CheckoutSessionCompleteService } from "../payment/checkoutsessioncomplete.service";
import { WaHelperService } from "../whatsapp/service/wa-helper.service";
import { MetaOAuthTokenService } from "../whatsapp/service/meta.oauth.token.service";
import { WabaIntegrationService } from "../whatsapp/service/waba.integration.service";
import { UpdateUserPackageProcess } from "./process/update-user-package.process";
import { BillingService } from "../billing-package/billing-package.service";
import { ImportGoogleContactProcess } from "./process/import-google-contact.process";
import { IntegrationsService } from "../integrations/integrations.service";
import { GoogleOauthFetcher } from "../auth/sso/google.oauth.fetcher";
import { SsoProviderService } from "../auth/service/ssoprovider.service";
import { TriggerModule } from "../trigger/trigger.module";
import { WebhookDataSyncProcess } from "./process/webhook_data_sync.process";

import { TwilioWebhookDataSyncProcess } from "./process/twilio_webhook_data_sync.process";
import { WebhookService } from "../whatsapp/service/webhook.service";
import { TwilioWebhookService } from "../webhook/twilio-webhook.service";
import { RealTimeTriggerProcess } from './process/realtime.trigger.process';
import { CronTriggerProcess } from './process/cron.trigger.process';
import { WebhookModule } from "../webhook/webhook.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InboxThreadModule } from "../inbox-thread/inbox-thread.module";
import { TriggerActionProcess } from './process/trigger.action.process';
import { TriggerActionProcessService } from '../trigger/services/trigger.action.process.service';
import { AddTagToContactActionExecutor } from "../trigger/services/trigger-action-executors/add-tag-to-contact.action.executor";
import { OptOutContactActionExecutor } from "../trigger/services/trigger-action-executors/optout-contact.action.executor";
import { PauseBroadcastActionExecutor } from "../trigger/services/trigger-action-executors/pause-broadcast.action.executor";
import { SendWhatsAppActionExecutor } from "../trigger/services/trigger-action-executors/send-whatsapp-message.action.executor";
import { UnsubscribeBroadcastActionExecutor } from "../trigger/services/trigger-action-executors/unsubscribe-broadcast.action.executor";
import { TriggerExecutionLogService } from "../trigger/services/trigger-execution-log.service";
import { NotificationService } from "../notifications/notifications.service";
import { OptOutService } from "../opt-out/opt-out.service";
import { ConversationService } from "../conversation/conversation.service";
import { ContactService } from "../contacts/contact.service";
import { RedisNotificationService } from "../notifications/redis.notifications.service";
import { PubSubService } from "../notifications/pubsub/pubsub.service";
import { InboxThreadService } from "../inbox-thread/inbox-thread.service";
import { WaBusinessNumberService } from "../whatsapp/service/wa.business.number.service";
import { SandboxMessageSender } from "../broadcast/broadcast-sender/sandbox.message.sender";
import { GatewayCredentialService } from "../gateway-provider/gateway.credential.service";
import { GatewayCredentialRepository } from "../broadcast/repository/gateway.credential.repository";
import { CronTriggerProcessService } from "../trigger/services/cron.trigger.process.service";
import { UnsubscribeFromAllBroadcastActionExecutor } from "../trigger/services/trigger-action-executors/unsubscribe-from-all-broadcast.executor";
import { PauseFromAllBroadcastActionExecutor } from "../trigger/services/trigger-action-executors/pause-from-all-broadcast.executor";
import { MessageLogService } from "../broadcast/message-log.service";
import { WaSenderLoaderService } from "@/common/helpers/wa.sender.loader.service";
import { AddContactToBroadcastActionExecutor } from "../trigger/services/trigger-action-executors/add-contact-to-broadcast.action.executor";
import { TriggerActivityLogService } from "../trigger/services/trigger.activitylog.service";

@Module({
  imports: [
    TriggerModule, // Add this to provide TriggerContactService
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.AUTO_RECHARGE
      },
      {
        name: QUEUE_NAMES.SYNC_META_DATA
      },
      {
        name: QUEUE_NAMES.CANCEL_SUBSCRIPTION
      },
      {
        name: QUEUE_NAMES.UPDATE_USER_PACKAGE
      },
      {
        name: QUEUE_NAMES.IMPORT_GOOGLE_CONTACTS
      },
      {
        name: QUEUE_NAMES.WEBHOOK_DATA_SYNC
      },
      {
        name: QUEUE_NAMES.TWILIO_WEBHOOK_DATA_SYNC
      },
      {
        name: QUEUE_NAMES.CRON_TRIGGER_JOB
      },
      {
        name: QUEUE_NAMES.REALTIME_TRIGGER_JOB
      },
      {
        name: QUEUE_NAMES.TRIGGER_ACTION_JOB
      },
      {
        name: 'notifications-queue'
      }
    ),
    BullBoardAuthModule,
    HttpModule,
    RedisModule,
    PaymentModule,
    WebhookModule,
    NotificationsModule,
    InboxThreadModule
  ],
  providers: [
    TasksService,
    AutoRechargeService,
    AutoRechargeProcess,
    EmailService,
    PrismaService,
    CommonService,
    UserService,
    PaymentService,
    BillingService,
    GoogleOauthFetcher,
    SsoProviderService,
    IntegrationsService,
    CancelSubscriptionProcess,
    StripeWebhookService,
    WebhookService,
    TwilioWebhookService,
    GA4Service,
    SyncMetaDataProcess,
    MetaDataSyncJobService,
    WhatsAppModule,
    CheckoutSessionCompleteService,
    WaHelperService,
    MetaOAuthTokenService,
    WabaIntegrationService,
    UpdateUserPackageProcess,
    ImportGoogleContactProcess,
    WebhookDataSyncProcess,
    TwilioWebhookDataSyncProcess,
    RealTimeTriggerProcess,
    CronTriggerProcessService,
    CronTriggerProcess,
    TriggerActionProcessService,
    TriggerActionProcess,
    AddTagToContactActionExecutor,
    OptOutContactActionExecutor,
    PauseBroadcastActionExecutor,
    SendWhatsAppActionExecutor,
    UnsubscribeBroadcastActionExecutor,
    UnsubscribeFromAllBroadcastActionExecutor,
    PauseFromAllBroadcastActionExecutor,
    AddContactToBroadcastActionExecutor,
    TriggerExecutionLogService,
    NotificationService,
    OptOutService,
    ConversationService,
    ContactService,
    UserService,
    RedisNotificationService,
    PubSubService,
    InboxThreadService,
    WaBusinessNumberService,
    SandboxMessageSender,
    GatewayCredentialService,
    GatewayCredentialRepository,
    MessageLogService,
    WaSenderLoaderService,
    TriggerActivityLogService,
  ]
})
export class TasksModule { } 
