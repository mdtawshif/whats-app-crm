import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { BillingService } from "src/modules/billing-package/billing-package.service";

@Processor(QUEUE_NAMES.UPDATE_USER_PACKAGE, {
    maxStalledCount: 0
})
@Injectable()
export class UpdateUserPackageProcess extends WorkerHost {
    constructor(
        private readonly billingService: BillingService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(UpdateUserPackageProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let updateUserPackageCronJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_UPDATE_USER_PACKAGE_PROCESS') !== 'false';

            this.logger.info('isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Update user package job is disabled via env. Skipping...");
                return;
            }

            updateUserPackageCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'update_user_package_id'
                }
            });

            if (!updateUserPackageCronJobData) {
                console.log('No cron job record found for update user package. Proceeding.');
                return;
            } else if (!updateUserPackageCronJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (updateUserPackageCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            console.log("Update user package Processor started", { jobId: job.id, data: job.data });
            console.log("Start update user package  ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: updateUserPackageCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.billingService.getQueuedRequestsScheduledForToday();
            console.log("Update user package processing completed");


        } catch (error) {
            console.log("Error processing update user package ===>", error);
            throw error;
        } finally {

            if (updateUserPackageCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: updateUserPackageCronJobData.id
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
