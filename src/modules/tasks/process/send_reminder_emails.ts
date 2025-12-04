import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PaymentService } from "src/modules/payment/payment.service";
import { PrismaService } from "nestjs-prisma";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CronJob, WebhookStatus } from "@prisma/client";
import { Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/library";

@Processor(QUEUE_NAMES.SEND_REMINDER_EMAIL, {
    maxStalledCount: 0,
})
@Injectable()
export class SendReminderEmailsTask extends WorkerHost {
    constructor(
        private readonly paymentService: PaymentService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        @InjectPinoLogger(SendReminderEmailsTask.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let sendRemainderEmailCornJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_SEND_REMINDER_EMAIL') !== 'false';

            console.log('isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Send Reminder Email job is disabled via env. Skipping...");
                return;
            }

            sendRemainderEmailCornJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'send_reminder_email_id'
                }
            });

            if (!sendRemainderEmailCornJobData) {
                console.log('No cron job record found for send remainder email. Proceeding.');
                return;
            } else if (!sendRemainderEmailCornJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (sendRemainderEmailCornJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("Reminder Email Processor started", { jobId: job.id, data: job.data });
            console.log("Start sending reminder emails ===>", new Date().toISOString());

            await this.prisma.cronJob.update({
                where: {
                    id: sendRemainderEmailCornJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            // Calculate date 2 days from now (June 3, 2025)
            const today = new Date();
            const reminderDate = new Date(today);
            reminderDate.setDate(today.getDate() + 2);
            reminderDate.setHours(0, 0, 0, 0); // Start of June 3, 2025

            const reminderDateEnd = new Date(reminderDate);
            reminderDateEnd.setHours(23, 59, 59, 999); // End of June 3, 2025

            this.logger.info(`Checking subscriptions with nextBillingDate between ${reminderDate.toISOString()} and ${reminderDateEnd.toISOString()}`);

            // Fetch active subscriptions due for renewal
            const subscriptions = await this.prisma.userPackage.findMany({
                where: {
                    status: "ACTIVE",
                    nextBillingDate: {
                        gte: reminderDate,
                        lte: reminderDateEnd,
                    },
                },
                select: {
                    id: true,
                    userId: true,
                    teamId: true,
                    packageId: true,
                    nextBillingDate: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            currentCreditAmount: true
                        },
                    },
                },
            });

            this.logger.info(`Found ${subscriptions.length} subscriptions for reminder`, {
                subscriptions: subscriptions.map(s => ({
                    id: s.id,
                    userId: s.userId,
                    packageId: s.packageId,
                    nextBillingDate: s.nextBillingDate,
                    userEmail: s.user.email,
                })),
            });

            // Process each subscription
            for (const subscription of subscriptions) {
                try {
                    this.logger.info(`Sending reminder for user ${subscription.userId}, package ${subscription.packageId}`);
                    await this.paymentService.sendReminderEmail({
                        user: subscription.user,
                        userId: subscription.userId,
                        teamId: subscription.teamId,
                        packageId: subscription.packageId,
                        currentCreditAmount: subscription.user.currentCreditAmount ?? new Decimal(0),
                        nextBillingDate: subscription.nextBillingDate,
                    });


                    this.logger.info(`Reminder email sent to ${subscription.user.email} for user ${subscription.userId}`);
                } catch (error) {
                    this.logger.error(
                        `Failed to send reminder email for user ${subscription.userId}: ${error.message}`,
                        error.stack
                    );
                    console.error(`Error sending reminder for user ${subscription.userId} ===>`, error);
                }
            }

            this.logger.info("Reminder email processing completed");
            console.log("Finished sending reminder emails ===>", new Date().toISOString());

        } catch (error) {
            this.logger.error(`Error processing reminder emails: ${error.message}`, error.stack);
            console.error("Error processing reminder emails ===>", error);
            throw error;
        } finally {

            if (sendRemainderEmailCornJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: sendRemainderEmailCornJobData.id
                    },
                    data: {
                        status: WebhookStatus.QUEUE,
                        lastProcessedAt: new Date(),
                        updatedAt: new Date()
                    }
                });
            }

        }
    }
}