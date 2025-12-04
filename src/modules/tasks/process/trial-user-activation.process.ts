import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { TrialUserActivationService } from "src/modules/payment/trial.user.activation.service";

@Processor(QUEUE_NAMES.TRIAL_USER_ACTIVATION, {
    maxStalledCount: 0
})
@Injectable()
export class TrialUserActivationProcess extends WorkerHost {
    constructor(
        private readonly trialUserActivationService: TrialUserActivationService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(TrialUserActivationProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let packageRenewCronJobData: CronJob = null;

        try {

            console.log("Trial user activation processing started");

            const isEnabled = this.configService.get<string>('ENABLE_TRIAL_USER_ACTIVATION_PROCESS') !== 'false';

            console.log('isEnabled', isEnabled);

            if (!isEnabled) {
                console.log("Trial user activation job is disabled via env. Skipping...");
                return;
            }

            packageRenewCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'trial_user_activation_id'
                }
            });

            if (!packageRenewCronJobData) {
                console.log('No cron job record found for trial user activation. Proceeding.');
                return;
            } else if (!packageRenewCronJobData.status) {
                console.log('Cron job status is null for trial user activation. Proceeding.');
                return;
            } else if (packageRenewCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running for trial user activation, so skip.');
                return;
            }

            console.log("Trial user activation Processor started", { jobId: job.id, data: job.data });

            await this.prisma.cronJob.update({
                where: {
                    id: packageRenewCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.trialUserActivationService.handleTrialUserActivationProcess();
            
            console.log("Trial user activation processing completed");


        } catch (error) {
            console.log("Error processing trial user activation report ===>", error);
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
