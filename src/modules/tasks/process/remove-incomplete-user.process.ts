import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, PackageStatus, WebhookStatus } from "@prisma/client";
import { UserCardInfo } from "src/modules/common/dto/common-dto";
import Stripe from "stripe";

@Processor(QUEUE_NAMES.REMOVE_INCOMPLETE_USER, {
    maxStalledCount: 0
})
@Injectable()
export class RemoveIncompleteUserProcess extends WorkerHost {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        @InjectPinoLogger(RemoveIncompleteUserProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let removeIncompleteUserCornJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_REMOVE_INCOMPLETE_USER_PROCESS') !== 'false';

            console.log('RemoveIncompleteUserProcess isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Remove incomplete user job is disabled via env. Skipping...");
                return;
            }

            removeIncompleteUserCornJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'remove_incomplete_user_id'
                }
            });

            if (!removeIncompleteUserCornJobData) {
                console.log('No cron job record found for remove incomplete user. Proceeding.');
                return;
            } else if (!removeIncompleteUserCornJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (removeIncompleteUserCornJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("remove incomplete user Processor started", { jobId: job.id, data: job.data });
            console.log("Start remove incomplete user report ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: removeIncompleteUserCornJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            const results = await this.prisma.$queryRaw<UserCardInfo[]>` 
                                                    SELECT uci.*
                                                    FROM user_card_infos uci
                                                    LEFT JOIN user_packages up ON uci.user_id = up.user_id
                                                    WHERE uci.status = 'ACTIVE'
                                                        AND up.user_id IS NULL
                                                        AND uci.customer_id IS NOT NULL
                                                        AND uci.created_at <= NOW() - INTERVAL 1 DAY
                                                    `;
            console.log("results", results);

            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                apiVersion: "2023-10-16",
            });

            for (const userCardInfo of results) {

                console.log("userCardInfo", userCardInfo);
                const stripeCustomerId = userCardInfo.customer_id;
                console.log("stripeCustomerId", stripeCustomerId);
                if (!stripeCustomerId) continue;

                try {
                    // 1. Fetch customer to ensure they exist
                    const customer = await stripe.customers.retrieve(stripeCustomerId);

                    // If customer is deleted or not found
                    console.log(`customer`, customer);
                    // customer { id: 'cus_SihX1gPnzSHvZX', object: 'customer', deleted: true }
                    if ((customer as any).deleted) {
                        console.log(`Customer ${stripeCustomerId} already deleted`);
                        await this.prisma.userCardInfo.update({
                            where: {
                                id: userCardInfo.id
                            },
                            data: {
                                status: PackageStatus.DELETED
                            }
                        });
                        continue;
                    }

                    // 2. Get attached payment methods
                    const paymentMethods = await stripe.paymentMethods.list({
                        customer: stripeCustomerId,
                        type: 'card',
                    });
                    console.log(`paymentMethods`, paymentMethods);
                    console.log(`paymentMethods.data.length`, paymentMethods.data.length);
                    // 3. If no payment methods, delete customer
                    if (paymentMethods.data.length === 0) {
                        await stripe.customers.del(stripeCustomerId);
                        console.log(`🗑️ Deleted customer: ${stripeCustomerId}`);
                    } else {
                        console.log(` Customer ${stripeCustomerId} has ${paymentMethods.data.length} payment method(s)`);
                    }

                    await this.prisma.userCardInfo.update({
                        where: {
                            id: userCardInfo.id
                        },
                        data: {
                            status: PackageStatus.DELETED
                        }
                    });

                } catch (error: any) {
                    console.error(`Error handling customer ${stripeCustomerId}:`, error.message);
                }

            }

            this.logger.info("remove incomplete user processing completed");

        } catch (error) {
            console.log("Error processing remove incomplete user ===>", error);
            throw error;
        } finally {

            if (removeIncompleteUserCornJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: removeIncompleteUserCornJobData.id
                    },
                    data: {
                        status: WebhookStatus.QUEUE,
                        lastProcessedAt: new Date(),
                        updatedAt: new Date()
                    }
                });
            } else {
                // Optionally log or ignore if no cron job record
                console.log('No cron job record found in finally block. Skipping update.');
            }
        }

    }

}
