import { JOB_IDS, QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { WebhookService } from "src/modules/whatsapp/service/webhook.service";

@Processor(QUEUE_NAMES.WEBHOOK_DATA_SYNC, {
    maxStalledCount: 0
})
@Injectable()
export class WebhookDataSyncProcess extends WorkerHost {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(WebhookDataSyncProcess.name)
        private readonly logger: PinoLogger,
        private readonly webhookService: WebhookService,
    ) {
        super();
    }

    async process(job: Job) {
        let cronData: CronJob = null;
        try {
            cronData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: JOB_IDS.WEBHOOK_DATA_SYNC_ID
                }
            });

            if (!cronData) {
                console.log('No cron job record found for webhook data sync. Proceeding.');
                return;
            } else if (!cronData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (cronData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("webhook data sync started", { jobId: job.id, data: job.data });
            this.logger.info("webhook data sync started time ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: cronData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            this.webhookService.webhookDataProcessCron();
            this.logger.info("webhook data sync process completed");


        } catch (error) {
            this.logger.info("Error processing meta data ===>", error);
            throw error;
        } finally {
            if (cronData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: cronData.id
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
