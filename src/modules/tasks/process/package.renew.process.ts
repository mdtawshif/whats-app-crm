import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { PackageRenewService } from "src/modules/payment/package.renew.service";

@Processor(QUEUE_NAMES.PACKAGE_RENEW, {
    // concurrency: 1,
    maxStalledCount: 0
})
@Injectable()
export class PackageRenewProcess extends WorkerHost {
    constructor(
        private readonly packageRenewService: PackageRenewService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(PackageRenewProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let packageRenewCronJobData: CronJob = null;

        try {

            console.log("Package Renew processing started");

            const isEnabled = this.configService.get<string>('ENABLE_PACKAGERENEW_PROCESS') !== 'false';

            console.log('isEnabled', isEnabled);

            if (!isEnabled) {
                console.log("Package renew job is disabled via env. Skipping...");
                return;
            }

            packageRenewCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'package_renew_id'
                }
            });

            if (!packageRenewCronJobData) {
                console.log('No cron job record found for package renew. Proceeding.');
                return;
            } else if (!packageRenewCronJobData.status) {
                console.log('Cron job status is null for package renew. Proceeding.');
                return;
            } else if (packageRenewCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running for package renew, so skip.');
                return;
            }

            console.log("Package Renew Processor started", { jobId: job.id, data: job.data });

            await this.prisma.cronJob.update({
                where: {
                    id: packageRenewCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.packageRenewService.handlePackageRenewProcess();
            
            console.log("Package Renew processing completed");


        } catch (error) {
            console.log("Error processing package renew report ===>", error);
            throw error;
        } finally {

            if (packageRenewCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: packageRenewCronJobData.id
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
