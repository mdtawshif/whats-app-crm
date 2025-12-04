import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PaymentService } from "src/modules/payment/payment.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";

@Processor(QUEUE_NAMES.CANCEL_SUBSCRIPTION, {
    // concurrency: 10,
    maxStalledCount: 0
})
@Injectable()
export class CancelSubscriptionProcess extends WorkerHost {
    constructor(
        private readonly paymentService: PaymentService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(CancelSubscriptionProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let cancelSubscriptionCornJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_CANCEL_SUPSCRIPTION_PROCESS') !== 'false';

            console.log('isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Cancel subscription job is disabled via env. Skipping...");
                return;
            }

            cancelSubscriptionCornJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'cancel_subscription_id'
                }
            });

            if (!cancelSubscriptionCornJobData) {
                console.log('No cron job record found for cacel subscription. Proceeding.');
                return;
            } else if (!cancelSubscriptionCornJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (cancelSubscriptionCornJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("Cancel Subscription Processor started", { jobId: job.id, data: job.data });
            console.log("Start cancel subscription report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: cancelSubscriptionCornJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });


            await this.paymentService.processCancelSubscriptions();
            this.logger.info("Cancel subscription processing completed");

        } catch (error) {
            console.log("Error processing cancel subscription ===>", error);
            throw error;
        } finally {

            if (cancelSubscriptionCornJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: cancelSubscriptionCornJobData.id
                    },
                    data: {
                        status: WebhookStatus.QUEUE,
                        lastProcessedAt: new Date(),
                        updatedAt: new Date()
                    }
                });
            } else {
                // Optionally log or ignore if no cron job record
                console.log('No cron job record found in finally block. Skipping update.');
            }
        }

    }

}
