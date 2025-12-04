import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import { ContactImportQueueStatus } from '@prisma/client';
import { ContactUploadQueueService } from './contact-upload-queue.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContactUploadCronService implements OnModuleInit {
    private readonly BATCH_LIMIT = 10;

    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: ContactUploadQueueService,
        private readonly logger: PinoLogger,
        private readonly configService: ConfigService,
    ) {
        this.logger.setContext(ContactUploadCronService.name);
    }

    async onModuleInit() {
        // Optionally recover stuck or failed jobs here
        // await this.recoverStuckJobs();
    }

    /**
     * Every 30 seconds:
     * - Fetch pending imports (limit 10)
     * - Enqueue them in bulk
     * - Update their status to QUEUED
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async processPendingImports() {
        this.logger.info('Checking for pending contact import queues...');

        try {
            const pendingImports = await this.prisma.contactImportQueue.findMany({
                where: { status: ContactImportQueueStatus.PENDING },
                orderBy: { createdAt: 'asc' },
                take: this.configService.get("FILE_IMPORT_BATCH_LIMIT", 200),
            });

            if (pendingImports.length === 0) {
                this.logger.debug('No pending contact import queues found');
                return;
            }

            this.logger.info(
                { count: pendingImports.length },
                `Processing ${pendingImports.length} pending imports`,
            );

            // Enqueue all pending imports
            await this.queueService.addBulkJobs(pendingImports);


            const pendingImportIds = pendingImports.map((imp) => imp.id);

            // Mark them as QUEUED to prevent reprocessing
            await this.prisma.contactImportQueue.updateMany({
                where: { id: { in: pendingImportIds } },
                data: { status: ContactImportQueueStatus.QUEUED },
            });


            this.logger.info(
                { count: pendingImports.length },
                `Marked ${pendingImports.length} imports as QUEUED`,
            );
        } catch (error) {
            this.logger.error({ error: error.message }, 'Failed to process contact import queue batch');
        }
    }
}
