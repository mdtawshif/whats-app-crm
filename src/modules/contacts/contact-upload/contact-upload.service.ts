import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, ContactStatus, NumberStatus, FileType, ContactImportQueueStatus, type ContactImportQueue, type Contact, NotificationType, type ContactCustomField } from '@prisma/client';
import { UploadContactsDto, ContactMappingDto, CustomFieldMappingDto, NotificationSourceType } from '../dto/index.dto';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import { validateAndFormatPhoneNumber } from '@/utils/phone-numbers/phone-utils';
import { parseBirthAnniversaryDate } from '@/utils/formatDate';
import { LoginUser } from '../../auth/dto/login-user.dto';
import { TriggerEventManager } from '../../trigger/services/trigger-event-manager/trigger-event-manager.service';
import { EventKeys } from 'src/types/triggers';
import { getContactDisplayName } from '@/utils/contact';
import { TRIGGER_EVENT_CONTACT_ACTIONS } from '../../trigger/constants/trigger.constant';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContactUploadFileDownloadService } from './contact-upload-file-download.service';

import { UserService } from '../../user/user.service';
import { NotificationService } from '../../notifications/notifications.service';
import type { CSVParseResult } from 'src/types/csv-parser';
import type { ContactUploadMetrics } from 'src/types/contacts';
import type { CreateTriggerEventQueueDto } from '../../trigger/dto/trigger-event-manager.dto';
import type { BasicUser } from '../../user/dto/user.dto';
import { parseCSV } from '@/utils/csv-parser';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import Papa from 'papaparse';
import { ContactUploadProcessWorker } from './contact.upload.process.worker';




/**
 * Service for uploading and processing large contact CSVs efficiently.
 */
@Injectable()
export class ContactUploadService {
    // Define valid contact fields for CSV mapping
    private readonly validFields = ['number', 'firstName', 'lastName', 'email', 'city', 'state', 'country', 'address', 'tags', 'birthDate', 'anniversaryDate'];

    // List required fields for contacts
    private readonly requiredFields = ['number', 'firstName', 'lastName'];

    // Set max length limits for fields
    private readonly fieldLimits: Record<string, number> = { email: 255, city: 190, state: 190, country: 190, firstName: 100, lastName: 100 };

    // Set batch size for processing contact CSV rows
    private readonly BATCH_SIZE = 200;

    // Inject dependencies
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
        private readonly contactUploadFileDownloadService: ContactUploadFileDownloadService,
        private readonly triggers: TriggerEventManager,
        private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly configService: ConfigService,
        private readonly contactUploadProcessWorker: ContactUploadProcessWorker
    ) {
        // Set logger context
        this.logger.setContext(ContactUploadService.name);
    }

    /**
     * Initiates contact file upload and queues it.
     */
    async uploadContactsCsvFile(user: LoginUser, dto: UploadContactsDto): Promise<ContactImportQueue> {
        // Validate input DTO
        await this.validateDto(dto);

        // Check field mappings
        this.validateMappings(dto.fieldMappings);

        // Create queue entry in DB
        const upload = await this.createQueueEntry(user, dto);

        // Log queue creation
        this.logger.info(`Created queue ${upload.id}`, { userId: user.id });

        return upload;
    }

    /**
     * Processes contact upload job with streamed CSV.
     */
    async processUpload(importQueue: ContactImportQueue): Promise<void> {
        
        try {

            // Verify user and agency
            const user = await this.validateUser(importQueue.userId);

            // Get or create contact source
            const sourceId = await this.getSource(importQueue.agencyId, importQueue.fileType);

            // Fetch upload details
            const { fieldMappings, country, hasHeaders } = await this.getUploadDetails(importQueue);

            // Download file content
            const fileContent = await this.contactUploadFileDownloadService.downloadFiles(importQueue.fileUrl);

            const headerMappings: string[] = await this.loadHeaderMapping(fieldMappings);

            await this.processFile(importQueue, fileContent, headerMappings, fieldMappings, user, sourceId);
            
            /**
             * @update import summary
             * @change import status -> completed/failed
             * @Send notification
             */
            await this.updateImportSummaryAndSendNotification(user, importQueue);
            
        } catch (error) {
            await this.handleError(importQueue.id, error);
            throw error;
        }
    }

    private async updateImportSummaryAndSendNotification(user:BasicUser, contactImportQueue: ContactImportQueue) {
        let status: ContactImportQueueStatus = ContactImportQueueStatus.FAILED;
        let fileSummary = JSON.stringify({
            Total: 0,
            Created: 0,
            Invalid: 0,
            Duplicate: 0,
            Edited: 0,
        });

        const result = await this.prisma.$queryRaw<{
            Total: number;
            Created: number;
            Invalid: number;
            Duplicate: number;
            Edited: number;
        }[]>`
            SELECT 
                COUNT(*) AS Total,
                SUM(IF(status = 'CREATED', 1, 0)) AS Created,
                SUM(IF(status = 'INVALID', 1, 0)) AS Invalid,
                SUM(IF(status = 'DUPLICATE', 1, 0)) AS Duplicate,
                SUM(IF(status = 'UPDATED', 1, 0)) AS Edited
            FROM contact_import_queue_logs
            WHERE contact_import_queue_id = ${contactImportQueue.id}
        `;

        if (result && result.length > 0) {
            status = ContactImportQueueStatus.COMPLETED;
            fileSummary = JSON.stringify(result[0]);
        }

        await this.prisma.contactImportQueue.update({
            where: { id: contactImportQueue.id },
            data: {
                status,
                fileSummary,
            },
        });

         //notify user about status
        await this.notifyUserUploadResult({ id: contactImportQueue.id, status, userId: user.id, agencyId: user.agencyId } as any, status === ContactImportQueueStatus.COMPLETED ? true : false);
    }

    private async loadHeaderMapping(fieldMappings: any): Promise<string[]>{
        const allMappings = [
                ...fieldMappings.contactMappings,
                ...fieldMappings.customFieldMappings,
                ...fieldMappings.tagMappings,
            ];

            // Determine the maximum csvFieldIndex to size the headers array
            const maxIndex = Math.max(...allMappings.map((m: any) => m.csvFieldIndex));
            const headers: string[] = Array(maxIndex + 1).fill(null);
            allMappings.forEach((mapping: any) => {
                headers[mapping.csvFieldIndex - 1] = mapping.csvField;
            });
        return headers;
    }

    /**
     * @Parse and Process File from stream
     * @param importQueue 
     * @param fileContent 
     */
    private async processFile(importQueue: ContactImportQueue, fileContent: Readable, headerMappings: string [], fieldMappings: any, user:BasicUser, sourceId: bigint) {
        let rowCount = 0;
        let chunkSize = await this.configService.get('CONTACT_CSV_CHUNK_SIZE', 3);
        let contacts: any[] = [];

        try {
        return new Promise((resolve, reject) => {
            Papa.parse(fileContent, {
                header: true, // Parse CSV headers into object keys
                skipEmptyLines: true,
                transform: (value) => value.trim(), // Trim whitespace from fields
                step: async (results, parser) => {
                    rowCount++;
                    const rowClone = typeof results.data === 'object' && results.data !== null ? { ...results.data } : {};
                    contacts.push(rowClone);
                   

                    if (contacts.length >= chunkSize) {
                    parser.pause();
                    try {
                        // can be used producer consumer pattern for efficent processing
                        // await this.contactQueue.add('process-contact-chunk', { chunk: contacts });
                        await this.contactUploadProcessWorker.processContacts(importQueue, contacts, headerMappings, fieldMappings, user, sourceId);
                        contacts = [];
                    } catch (error) {
                        reject(error);
                    }
                    parser.resume();
                  }
                },
                complete: async () => {
                    if (contacts.length > 0) {
                    try {
                        // can be used producer consumer pattern for efficent processing
                        // await this.contactQueue.add('process-contact-chunk', { chunk: contacts });
                        await this.contactUploadProcessWorker.processContacts(importQueue, contacts, headerMappings, fieldMappings, user, sourceId);
                        console.log(`Processed final chunk: ${JSON.stringify(contacts)}`);
                        console.log(`Processed final chunk size: ${contacts.length}`);
                    } catch (error) {
                        reject(error);
                    }
                    }
                    console.log(`Total rows processed: ${rowCount}`);
                    resolve(rowCount);
                },
                error: (error) => {
                    if (error.message.includes('Invalid Record')) {
                    reject(new BadRequestException('Invalid CSV format'));
                    } else {
                    reject(new BadRequestException(`Failed to process CSV stream: ${error.message}`));
                    }
                },
                });
            });
        } catch (error) {
            throw new BadRequestException(`Failed to process CSV stream: ${error.message}`);
       }
    }

    /**
     * Validates input DTO.
     */
    private async validateDto(dto: UploadContactsDto): Promise<void> {
        // Run class-validator on DTO
        const errors = await validate(dto);

        // Throw if validation fails
        if (errors.length) throw new BadRequestException(`Invalid ContactImportQueue DTO: ${JSON.stringify(errors)}`);
    }

    /**
     * Validates field mappings.
     */
    private validateMappings(fieldMappings: any): void {
        // Check required fields are mapped
        const mapped = new Set(fieldMappings.contactMappings.map((m: ContactMappingDto) => m.contactField));
        if (!this.requiredFields.every((f) => mapped.has(f))) {
            throw new BadRequestException(`Missing required fields: ${this.requiredFields.join(', ')}`);
        }

        // Combine all mappings
        const mappings = [...fieldMappings.contactMappings, ...fieldMappings.customFieldMappings, ...fieldMappings.tagMappings];

        // Validate each mapping
        for (const m of mappings) {
            if (!m.csvField || !m.contactField || m.csvFieldIndex < 0) {
                throw new BadRequestException(`Invalid mapping: ${JSON.stringify(m)}`);
            }
            if (!this.validFields.includes(m.contactField) && !m.customFieldId) {
                throw new BadRequestException(`Invalid field: ${m.contactField}`);
            }
            if (m.contactField === 'tags' && !fieldMappings.tagMappings.includes(m)) {
                throw new BadRequestException('Tags must be in tagMappings');
            }
        }

        // Clear temporary Set and array to free memory
        mapped.clear();
        mappings.length = 0;
    }

    /**
     * Creates import queue entry.
     */
    private async createQueueEntry(user: LoginUser, dto: UploadContactsDto): Promise<ContactImportQueue> {
        // Create queue entry with metadata
        return this.prisma.contactImportQueue.create({
            data: {
                agencyId: user.agencyId,
                userId: user.parentUserId ?? user.id,
                fieldMapping: JSON.stringify(dto.fieldMappings),
                fileName: dto.fileName,
                fileType: dto.fileType,
                fileUrl: dto.fileUrl,
                status: ContactImportQueueStatus.PENDING,
                country: dto.defaultCountry,
                countryCode: dto.defaultCountryCode,
            },
        });
    }


    /**
     * Validates user and agency.
     */
    private async validateUser(userId: bigint): Promise<BasicUser> {
        // Fetch user by ID and agency
        const user = await this.userService.findBasicUserById(userId);

        // Throw if user not found
        if (!user) throw new BadRequestException(`User ${userId} not found`);

        return user
    }

    /**
     * Gets or creates contact source.
     */
    private async getSource(agencyId: bigint, fileType: FileType): Promise<bigint> {
        // Upsert contact source
        const source = await this.prisma.contactSource.upsert({
            where: { contact_sources_agency_id_name_unique: { name: fileType, agencyId } },
            update: {},
            create: { agencyId, name: fileType, description: fileType, createdAt: new Date(), updatedAt: new Date() },
            select: { id: true },
        });

        return source.id;
    }

    /**
     * Updates queue status.
     */
    public async setQueueStatus(uploadId: bigint, status: ContactImportQueueStatus): Promise<void> {
        // Update queue status
        await this.prisma.contactImportQueue.update({ where: { id: uploadId }, data: { status } });
    }

    /**
     * Gets and validates upload details.
     */
    private async getUploadDetails(importQueue: ContactImportQueue): Promise<{
        fieldMappings: any;
        country: string;
        hasHeaders: boolean;}> {
        const parsed = JSON.parse(importQueue.fieldMapping);
        const uploadDto = plainToInstance(UploadContactsDto, { fieldMappings: parsed });

        const errors = await validate(uploadDto);
        if (errors.length) throw new BadRequestException(`Invalid mappings: ${JSON.stringify(errors)}`);

        return {
            fieldMappings: uploadDto.fieldMappings,
            country: importQueue.country || 'US',
            hasHeaders: uploadDto.fieldMappings.configs.hasHeaders,
        };
    }

    /**
     * Handles processing errors.
     */
    private async handleError(uploadId: bigint, error: any): Promise<void> {
        const message = `Failed upload ${uploadId}: ${error.message}`;
        this.logger.error(message, { uploadId });

        await this.prisma.contactImportQueue.update({
            where: { id: uploadId },
            data: { status: ContactImportQueueStatus.FAILED, errorMessage: message},
        });
    }


    /**
    * Sends notification on completion.
    * Why: Informs user of success or failure.
    * What: Sends notification via NotificationService.
    */
    public async notifyUserUploadResult(importQueue: ContactImportQueue, success: boolean) {
        const payload = {
            title: success ? 'Contact import complete!' : 'Contact import failed!',
            message: success ? 'View contacts in the contacts tab.' : 'Check contact queue list for details.',
            data: {
                id: importQueue.id,
                navigatePath: '/contacts',
                errorNavigatePath: '/contact-queue-list',
                type: success ? NotificationSourceType.SUCCESS : NotificationSourceType.ERROR,
            },
            navigatePath: '/contacts',
        };
        try {
            await this.notificationService.sendToUser(
                importQueue?.userId,
                importQueue?.agencyId,
                NotificationType.CONTACT_IMPORT_ALERT,
                payload,
            );
            this.logger.info(`Notified user for import ${importQueue.id}`, { userId: importQueue?.userId });
        } catch (error) {
            this.logger.error(`Notification failed for import ${importQueue.id}: ${error.message}`, { importQueueId: importQueue.id });
        }
    }
}