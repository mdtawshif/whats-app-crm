import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostmarkProvider } from './postmart.provider';
import { PrismaService } from 'nestjs-prisma';
import { Models } from 'postmark';
import { SendLogStatus, SendLogType, YesNo } from '@prisma/client';
import { getAgency } from '@/common/helpers/default-agency-role-id.helper';
import { DEFAULT_AGENCY_NAME } from '@/utils/global-constant';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly postmarkProvider: PostmarkProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.postmarkProvider = new PostmarkProvider(this.configService);
  }

  public async sendEmailWithOutVerification({
    to,
    subject,
    body,
    user_id,
    attachments,
  }: {
    to: string;
    subject: string;
    body: string;
    user_id: bigint;
    // team_id: bigint;
    attachments?: Models.Attachment[];
  }): Promise<boolean> {
    const systemEmail = this.configService.get<string>('SYSTEM_EMAIL');
    const apiKey = this.configService.get<string>('POSTMARK_API_KEY');

    if (!systemEmail || !apiKey) {
      this.logger.error('Missing system email or Postmark API key.');
      return false;
    }

    if (!to || !subject || !body || !user_id ) {
      this.logger.error('Missing required email parameters.');
      return false;
    }

    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    // Step 1: Log email as NEW
    const log = await this.prisma.sendLog.create({
      data: {
        to,
        from: systemEmail,
        payload: JSON.stringify({ subject, body }),
        userId: user_id,
        // teamId: team_id,
        agencyId: agency?.id,
        type: SendLogType.EMAIL,
        providerName: 'POSTMARK',
        status: SendLogStatus.NEW,
      },
    });

    try {
      const isSent = await this.postmarkProvider.sendMail({
        to,
        subject,
        body,
        attachments,
        auth: {
          api_key: apiKey,
          sender_address: systemEmail,
        },
        from: '', // Optional: use systemEmail if required
      });

      // Step 2: Update log status based on result
      await this.prisma.sendLog.update({
        where: { id: log.id },
        data: {
          status: isSent ? SendLogStatus.COMPLETED : SendLogStatus.FAILED,
          sentAt: isSent ? new Date() : undefined,
          errorMessage: isSent
            ? null
            : 'Postmark returned unsuccessful status',
        },
      });

      return isSent;
    } catch (error) {
      this.logger.error('Email send failed', error);

      if (log?.id) {
        try {
          await this.prisma.sendLog.update({
            where: { id: log.id },
            data: {
              status: SendLogStatus.FAILED,
              errorMessage: error?.message || 'Unknown error',
            },
          });
        } catch (logError) {
          this.logger.error(
            'Failed to update sendLogs after email failure:',
            logError,
          );
        }
      } else {
        this.logger.warn(
          'Log ID not available. Failed to record email failure.',
        );
      }

      return false;
    }
  }

  public async sendEmail({
    to,
    subject,
    body,
    user_id,
    attachments,
  }: {
    to: string;
    subject: string;
    body: string;
    user_id: bigint;
    // team_id: bigint;
    attachments?: Models.Attachment[];
  }): Promise<boolean> {
    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    const systemEmail = this.configService.get<string>('SYSTEM_EMAIL');
    const apiKey = this.configService.get<string>('POSTMARK_API_KEY');
    const shouldCheckUserEmailVerification =
      this.configService.get<string>('SHOULD_CHECK_USER_EMAIL_VERIFICATION') ===
      'true';

    if (!systemEmail || !apiKey) {
      this.logger.error('Missing system email or Postmark API key.');
      return false;
    }

    if (!to || !subject || !body || !user_id ) {
      this.logger.error('Missing required email parameters.');
      return false;
    }

    console.log(
      'shouldCheckUserEmailVerification',
      shouldCheckUserEmailVerification,
    );

    if (shouldCheckUserEmailVerification) {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { isMailVerified: true },
      });

      if (!user || user.isMailVerified === YesNo.NO) {
        this.logger.warn(`User ${user_id} email not verified. Skipping email.`);
        return false;
      }
    }

    // Step 1: Log email as NEW
    const log = await this.prisma.sendLog.create({
      data: {
        to,
        from: systemEmail,
        payload: JSON.stringify({ subject, body }),
        userId: user_id,
        // teamId: team_id,
        agencyId: agency.id,
        type: SendLogType.EMAIL,
        providerName: 'POSTMARK',
        status: SendLogStatus.NEW,
      },
    });

    try {
      const isSent = await this.postmarkProvider.sendMail({
        to,
        subject,
        body,
        attachments,
        auth: {
          api_key: apiKey,
          sender_address: systemEmail,
        },
        from: '', // Optional: use systemEmail if required
      });

      // Step 2: Update log status based on result
      await this.prisma.sendLog.update({
        where: { id: log.id },
        data: {
          status: isSent ? SendLogStatus.COMPLETED : SendLogStatus.FAILED,
          sentAt: isSent ? new Date() : undefined,
          errorMessage: isSent
            ? null
            : 'Postmark returned unsuccessful status',
        },
      });

      return isSent;
    } catch (error) {
      this.logger.error('Email send failed', error);

      if (log?.id) {
        try {
          await this.prisma.sendLog.update({
            where: { id: log.id },
            data: {
              status: SendLogStatus.FAILED,
              errorMessage: error?.message || 'Unknown error',
            },
          });
        } catch (logError) {
          this.logger.error(
            'Failed to update sendLogs after email failure:',
            logError,
          );
        }
      } else {
        this.logger.warn(
          'Log ID not available. Failed to record email failure.',
        );
      }

      return false;
    }
  }
}
