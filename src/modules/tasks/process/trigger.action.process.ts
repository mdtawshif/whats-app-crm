import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, CronJobStatus } from "@prisma/client";
import { JOB_IDS } from '../../../common/constants/queues.constants';
import { TriggerActionProcessService } from '../../trigger/services/trigger.action.process.service';

@Processor(QUEUE_NAMES.TRIGGER_ACTION_JOB, {
    maxStalledCount: 0
})
@Injectable()
export class TriggerActionProcess extends WorkerHost {
    constructor(
        private readonly triggerActionProcessService: TriggerActionProcessService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(TriggerActionProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let triggerActionCronJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_TRIGGER_ACTION_JOB') !== 'false';

            console.info('isEnabled', isEnabled);

            if (!isEnabled) {
                console.info("Trigger action job is disabled via env. Skipping...");
                return;
            }

            triggerActionCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: JOB_IDS.REALTIME_TRIGGER_JOB_ID
                }
            });

            if (!triggerActionCronJobData) {
                console.log('No cron job record found for trigger action. Proceeding.');
                return;
            } else if (!triggerActionCronJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (triggerActionCronJobData.status === CronJobStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            console.info("Trigger action processor started", { jobId: job.id, data: job.data });
            console.info("Start trigger action report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: triggerActionCronJobData.id
                },
                data: {
                    status: CronJobStatus.PROCESSING
                }
            });

            await this.triggerActionProcessService.processTriggerAction();
            
            console.info("Realtime trigger report processing completed");

            await this.prisma.cronJob.update({
                where: {
                    id: triggerActionCronJobData.id
                },
                data: {
                    status: CronJobStatus.QUEUE,
                    lastProcessedAt: new Date(),
                    updatedAt: new Date()
                }
            });


        } catch (error) {
            console.info("Error processing realtime trigger report ===>", error);
        } finally {

            if (triggerActionCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: triggerActionCronJobData.id
                    },
                    data: {
                        status: CronJobStatus.QUEUE,
                        lastProcessedAt: new Date(),
                        updatedAt: new Date()
                    }
                });
            }

        }

    }



}
