import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ContactImportQueue } from '@prisma/client';
import { QUEUE_NAMES } from '@/common/constants/queues.constants';

/**
 * Service for enqueuing contact import jobs.
 * What: Adds upload jobs to BullMQ queue for async processing.
 * Why: Manages scalable, fault-tolerant contact import queueing.
 */
@Injectable()
export class ContactUploadQueueService {
    constructor(
        @InjectQueue(QUEUE_NAMES.CONTACT_IMPORT_QUEUE) private readonly queue: Queue,
        private readonly logger: PinoLogger,
    ) {
        // Set logger context for tracing
        this.logger.setContext(ContactUploadQueueService.name);
    }

    /**
     * Adds a single contact import job to the queue.
     * What: Enqueues one import job with unique name.
     * Why: Schedules async processing for a single upload.
     * Will be processed in contact-upload.processor file
     */
    async addJob(importQueue: ContactImportQueue) {
        // Define unique job name
        const jobName = `contact-import:${importQueue.id}`;

        try {
            // Add job to BullMQ queue
            const job = await this.queue.add(jobName, importQueue, {
                backoff: { type: 'exponential' },
            });

            // Log job addition
            this.logger.info(`Added job ${job.id} for import ${importQueue.id}`, { importQueueId: importQueue.id });
            return job;
        } catch (error) {
            // Log and throw error
            this.logger.error(`Failed to add job for import ${importQueue.id}: ${error.message}`, { importQueueId: importQueue.id });
            throw error;
        }
    }

    /**
     * Adds multiple contact import jobs to the queue.
     * What: Enqueues bulk import jobs with unique names.
     * Why: Efficiently schedules multiple uploads for async processing.
     * Will be processed in contact-upload.processor file
     */
    async addBulkJobs(importQueues: ContactImportQueue[]) {
        // Exit if no queues
        if (!importQueues.length) {
            this.logger.debug('No import queues to enqueue');
            return [];
        }

        try {
            // Prepare bulk jobs with unique names
            const jobs = importQueues.map((queue) => ({
                name: `contact-import:${queue.id}`,
                data: queue,
                opts: { backoff: { type: 'exponential' } },
            }));

            // Add jobs to BullMQ queue
            const addedJobs = await this.queue.addBulk(jobs);

            // Log bulk job addition
            this.logger.info(`Added ${addedJobs.length} jobs for imports`, { importQueueIds: importQueues.map((q) => q.id) });
            return addedJobs;
        } catch (error) {
            // Log and throw error
            this.logger.error(`Failed to add bulk jobs for imports: ${error.message}`, { importQueueIds: importQueues.map((q) => q.id) });
            throw error;
        }
    }
}