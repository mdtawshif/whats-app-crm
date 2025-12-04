import { Test, TestingModule } from '@nestjs/testing';
import { TwilioWebhookService } from './twilio-webhook.service';

describe('WebhookService', () => {
  let service: TwilioWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TwilioWebhookService],
    }).compile();

    service = module.get<TwilioWebhookService>(TwilioWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
