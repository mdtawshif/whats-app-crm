import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import { EmailProvider } from './email.provider';
import { EmailParams } from './types/mailgun-email.type';

@Injectable()
export class PostmarkProvider implements EmailProvider {
  private readonly logger = new Logger(PostmarkProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMail(emailParams: EmailParams): Promise<boolean> {
    const { to, subject, body, auth, attachments } = emailParams;

    const apiKey =
      auth?.api_key || this.configService.get<string>('POSTMARK_API_KEY');
    const from =
      auth?.sender_address ||
      auth?.userName ||
      this.configService.get<string>('SYSTEM_EMAIL');

    if (!apiKey || apiKey === 'mock') {
      this.logger.warn('Postmark API Key not found — MOCKING email send');
      this.logger.log(
        `To: ${to}\nSubject: ${subject}\nFrom: ${from}\nBody:\n${body}`,
      );
      return true;
    }

    try {
      const client = new postmark.ServerClient(apiKey);
      const response = await client.sendEmail({
        From: from,
        To: to,
        Subject: subject,
        HtmlBody: body,
        Attachments: attachments,
      });

      console.log('===========', response);

      this.logger.log(`Postmark email sent: ${JSON.stringify(response)}`);
      return true;
    } catch (error) {
      console.log('postmark error=========', error);
      this.logger.error('Postmark email failed', error);
      throw new Error('Failed to send email');
    }
  }

  async verifyProvider(auth: VerifyMail): Promise<boolean> {
    return true; // For now, always return true in dev
  }
}
