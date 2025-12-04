import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ContactImportQueue, ContactImportQueueStatus } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { ContactUploadService } from './contact-upload.service';
import { QUEUE_NAMES } from '@/common/constants/queues.constants';

/**
 * BullMQ processor for contact import jobs.
 * Why: Handles async processing with notifications.
 * What: Calls service and sends success/failure notifications.
 */
@Injectable()
@Processor(QUEUE_NAMES.CONTACT_IMPORT_QUEUE, { concurrency: 10 }) // 10 concurrent workers
export class ContactUploadProcessor extends WorkerHost {
    constructor(
        private readonly contactUploadService: ContactUploadService,
        private readonly logger: PinoLogger,
    ) {
        super();
        this.logger.setContext(ContactUploadProcessor.name);
    }

    /**
     * Processes a contact import job.
     * Why: Executes upload and notifies user.
     * What: Calls service and sends notification.
     */
    async process(job: Job<ContactImportQueue>) {
        this.logger.info(`Processing job ${job.id}`, { importQueueId: job.data.id });
        try {

            // Update queue status
            await this.contactUploadService.setQueueStatus(job.data.id, ContactImportQueueStatus.PROCESSING);

            // Main starting point of csv processing and build contacts
            await this.contactUploadService.processUpload(job.data);

            //queue status updating and notifying handling on upload service
        } catch (error) {

            // Notify user of failure
            await this.contactUploadService.notifyUserUploadResult(job.data, false);


            //queue status failed handling on upload service

            // Log error
            this.logger.error(`Failed to process job ${job.id}: ${error.message}`, { importQueueId: job.data.id, error });
            // throw error; //no need to retry
        }
    }
}