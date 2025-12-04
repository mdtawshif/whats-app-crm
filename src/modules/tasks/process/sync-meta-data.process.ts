import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { MetaDataSyncJobService } from "src/modules/whatsapp/service/metaDataSyncJobs.service";

@Processor(QUEUE_NAMES.SYNC_META_DATA, {
    maxStalledCount: 0
})
@Injectable()
export class SyncMetaDataProcess extends WorkerHost {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(SyncMetaDataProcess.name)
        private readonly logger: PinoLogger,
        private readonly metaDataSyncJobService: MetaDataSyncJobService,
    ) {
        super();
    }

    async process(job: Job) {

        let syncMetaData: CronJob = null;

        try {

            // const isEnabled = this.configService.get<string>('ENABLE_UPDATE_USER_PACKAGE_PROCESS') !== 'false';

            // this.logger.info('isEnabled', isEnabled);

            // if (!isEnabled) {
            //     this.logger.warn("Update user package job is disabled via env. Skipping...");
            //     return;
            // }

            syncMetaData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'sync_meta_data_id'
                }
            });

            if (!syncMetaData) {
                console.log('No cron job record found for update user package. Proceeding.');
                return;
            } else if (!syncMetaData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (syncMetaData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("Update user package Processor started", { jobId: job.id, data: job.data });
            this.logger.info("Start update user package report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: syncMetaData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            this.metaDataSyncJobService.syncWithMeta();
            this.logger.info("Sync meta data process completed");


        } catch (error) {
            this.logger.info("Error processing meta data ===>", error);
            throw error;
        } finally {
            if (syncMetaData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: syncMetaData.id
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
