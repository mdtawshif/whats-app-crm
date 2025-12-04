import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { JOB_IDS } from '../../../common/constants/queues.constants';
import { RealtimeTriggerProcessService } from '../../trigger/services/realtime.trigger.process.service';

@Processor(QUEUE_NAMES.REALTIME_TRIGGER_JOB, {
    maxStalledCount: 0
})
@Injectable()
export class RealTimeTriggerProcess extends WorkerHost {
    constructor(
        private readonly realtimeTriggerProcessService: RealtimeTriggerProcessService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(RealTimeTriggerProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let realtimeCronJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_REALTIME_TRIGGER_JOB') !== 'false';

            console.info('isEnabled', isEnabled);

            if (!isEnabled) {
                console.info("Realtime trigger job is disabled via env. Skipping...");
                return;
            }

            realtimeCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: JOB_IDS.REALTIME_TRIGGER_JOB_ID
                }
            });

            if (!realtimeCronJobData) {
                console.log('No cron job record found for realtime trigger. Proceeding.');
                return;
            } else if (!realtimeCronJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (realtimeCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            console.info("Realtime trigger processor started", { jobId: job.id, data: job.data });
            console.info("Start realtime report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: realtimeCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.realtimeTriggerProcessService.processRealTimeTrigger();
            
            console.info("Realtime trigger report processing completed");

            await this.prisma.cronJob.update({
                where: {
                    id: realtimeCronJobData.id
                },
                data: {
                    status: WebhookStatus.QUEUE,
                    lastProcessedAt: new Date(),
                    updatedAt: new Date()
                }
            });


        } catch (error) {
            console.info("Error processing realtime trigger report ===>", error);
        } finally {

            if (realtimeCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: realtimeCronJobData.id
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
