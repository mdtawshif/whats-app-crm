import {  Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { TwilioWebhookService } from './twilio-webhook.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { InboxThreadModule } from '../inbox-thread/inbox-thread.module';
import { TriggerModule } from '../trigger/trigger.module';

@Module({
  imports: [NotificationsModule, InboxThreadModule, TriggerModule],
  controllers: [WebhookController],
  providers: [TwilioWebhookService],
  exports: [TwilioWebhookService], // Export if other modules need it
})
export class WebhookModule { }
