import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TwilioWebhookService } from './twilio-webhook.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly twilioWebhookService: TwilioWebhookService) { }

  // 1️⃣ Handle incoming WhatsApp/SMS messages
  @Post('reply')
  async handleIncomingMessage(@Body() body: any) {
    console.log('Received webhook body:', body);
    // Twilio sends message details in body
    return this.twilioWebhookService.handleIncomingMessage(body);
  }

  // 2️⃣ Handle status callback (delivery, read receipts, etc.)
  @Post('status-callback')
  async handleStatusCallback(@Body() body: any) {
    console.log('Received status callback body:', body);
    // Twilio sends status updates as query params
    return this.twilioWebhookService.handleStatusCallback(body);
  }

}
