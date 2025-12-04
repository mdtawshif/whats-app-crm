import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AutoRechargeService } from "src/modules/payment/autorecharge.service";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { UserService } from "src/modules/user/user.service";

@Processor(QUEUE_NAMES.NEGATIVE_USER_LIST, {
    maxStalledCount: 0
})
@Injectable()
export class NegativeUsersListProcess extends WorkerHost {
    constructor(
        private readonly userService: UserService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(NegativeUsersListProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let negativeUsersListCronJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_NEGATIVE_USER_LIST_PROCESS') !== 'false';

            console.log('isEnabled', isEnabled);

            if (!isEnabled) {
                console.log("Negative users list job is disabled via env. Skipping...");
                return;
            }

            negativeUsersListCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'negative_users_list_id'
                }
            });

            if (!negativeUsersListCronJobData) {
                console.log('No cron job record found for negative users list. Proceeding.');
                return;
            } else if (!negativeUsersListCronJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (negativeUsersListCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            console.log("Negative Users List Processor started", { jobId: job.id, data: job.data });
            console.log("Start processing negative users list ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: negativeUsersListCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.userService.getAllUsersCreditStatus();
            console.log("Negative Users List processing completed");


        } catch (error) {
            console.log("Error processing negative users list ===>", error);
            throw error;
        } finally {

            if (negativeUsersListCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: negativeUsersListCronJobData.id
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
