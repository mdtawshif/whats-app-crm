import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AutoRechargeService } from "src/modules/payment/autorecharge.service";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";

@Processor(QUEUE_NAMES.AUTO_RECHARGE, {
    maxStalledCount: 0
})
@Injectable()
export class AutoRechargeProcess extends WorkerHost {
    constructor(
        private readonly autoRechargeService: AutoRechargeService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(AutoRechargeProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let autoRechargeCronJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_AUTO_RECHARGE_PROCESS') !== 'false';

            this.logger.info('isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Auto recharge job is disabled via env. Skipping...");
                return;
            }

            autoRechargeCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'auto_recharge_id'
                }
            });

            if (!autoRechargeCronJobData) {
                console.log('No cron job record found for auto recharge. Proceeding.');
                return;
            } else if (!autoRechargeCronJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (autoRechargeCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("Auto Recharge Processor started", { jobId: job.id, data: job.data });
            this.logger.info("Start auto recharge report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: autoRechargeCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.autoRechargeService.handleAutoRecharges();
            this.logger.info("Auto Recharge report processing completed");


        } catch (error) {
            this.logger.info("Error processing auto recharge report ===>", error);
            throw error;
        } finally {

            if (autoRechargeCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: autoRechargeCronJobData.id
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
