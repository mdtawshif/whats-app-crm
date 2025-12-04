import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from 'bullmq';
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import { CronJob, WebhookStatus } from "@prisma/client";
import { IntegrationsService } from "src/modules/integrations/integrations.service";
import { NotificationService } from "src/modules/notifications/notifications.service";

@Processor(QUEUE_NAMES.IMPORT_GOOGLE_CONTACTS, {
    maxStalledCount: 0
})
@Injectable()
export class ImportGoogleContactProcess extends WorkerHost {
    constructor(
        private readonly integrationsService: IntegrationsService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        @InjectPinoLogger(ImportGoogleContactProcess.name)
        private readonly logger: PinoLogger
    ) {
        super();
    }

    async process(job: Job) {

        let importGoogleContactsCronJobData: CronJob = null;

        try {

            const isEnabled = this.configService.get<string>('ENABLE_IMPORT_GOOGLE_CONTACT_PROCESS') !== 'false';

            this.logger.info('isEnabled', isEnabled);

            if (!isEnabled) {
                this.logger.warn("Import google contact job is disabled via env. Skipping...");
                return;
            }

            importGoogleContactsCronJobData = await this.prisma.cronJob.findFirst({
                where: {
                    jobId: 'import_google_contacts_id'
                }
            });

            if (!importGoogleContactsCronJobData) {
                console.log('No cron job record found for import google contacts. Proceeding.');
                return;
            } else if (!importGoogleContactsCronJobData.status) {
                console.log('Cron job status is null. Proceeding.');
                return;
            } else if (importGoogleContactsCronJobData.status === WebhookStatus.PROCESSING) {
                console.log('A process already running, so skip.');
                return;
            }

            this.logger.info("Import google contacts Processor started", { jobId: job.id, data: job.data });
            this.logger.info("Start import google contacts ===>", new Date());

            await this.prisma.cronJob.update({
                where: {
                    id: importGoogleContactsCronJobData.id
                },
                data: {
                    status: WebhookStatus.PROCESSING
                }
            });

            await this.integrationsService.importAllGoogleContacts();
            this.logger.info("Import google contacts processing completed");

            // Notify admin user about completion

            this.logger.info("Import google contacts completed");
          
        } catch (error) {
            this.logger.info("Error processing import google contacts ===>", error);
            throw error;
        } finally {

            if (importGoogleContactsCronJobData) {
                await this.prisma.cronJob.update({
                    where: {
                        id: importGoogleContactsCronJobData.id
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
