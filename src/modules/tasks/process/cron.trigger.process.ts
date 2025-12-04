import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { JOB_IDS } from '../../../common/constants/queues.constants';
import { CronTriggerProcessService } from "src/modules/trigger/services/cron.trigger.process.service";

@Processor(QUEUE_NAMES.CRON_TRIGGER_JOB, {
    maxStalledCount: 0
})
@Injectable()
export class CronTriggerProcess extends WorkerHost {
    constructor(
        private readonly cornTriggerProcessService: CronTriggerProcessService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(CronTriggerProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let cronTriggerJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_CRON_TRIGGER_JOB') !== 'false';

            this.logger.info('isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Realtime trigger job is disabled via env. Skipping...");
                return;
            }

            cronTriggerJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: JOB_IDS.CRON_TRIGGER_JOB_ID
                }
            });

            if (!cronTriggerJobData) {
                console.log('No cron job record found for cron trigger. Proceeding.');
                return;
            } else if (!cronTriggerJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (cronTriggerJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("Cron trigger Processor started", { jobId: job.id, data: job.data });
            this.logger.info("Start cron trigger report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: cronTriggerJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.cornTriggerProcessService.processCronTrigger();
            this.logger.info("Cron trigger report processing completed");

            await this.prisma.cronJob.update({
                where: {
                    id: cronTriggerJobData.id
                },
                data: {
                    status: WebhookStatus.QUEUE,
                    lastProcessedAt: new Date(),
                    updatedAt: new Date()
                }
            });


        } catch (error) {
            this.logger.info("Error processing cron trigger report ===>", error);
            throw error;
        } finally {

            if (cronTriggerJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: cronTriggerJobData.id
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
