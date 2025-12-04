import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import type { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { ContactService } from 'src/modules/contacts/contact.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';
import { ActivityAction, ActivityCategory, Contact } from '@prisma/client';
import { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { createActivity } from '@/common/helpers/activity-log.helper';


/**
 * Service for managing tag addition operations for contacts.
 * Main methods at top, helper functions at bottom.
 */
@Injectable()
export class TriggerTagService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService,
        private readonly contactService: ContactService) {
        this.logger.setContext(TriggerTagService.name);
    }

    /**
     * Processes a tag addition operation for a single contact.
     * @param contactId - Contact ID
     * @param tagIds - Array of tag IDs
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param createdBy - User ID who created the operation
     */
    async processAddTagsOperation(cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload, tagIds: string[], user: BasicUser): Promise<TriggerExecutionResult> {

        this.logger.info(`Adding tags to contact ${cacheTriggerEventActionQueue.contactId}`);

        const tagList = tagIds.map((id) => BigInt(id));
        const errors: string[] = [];

        try {
            const result = await this.prisma.$transaction(async (tx) => {
              
                const contact = await this.contactService.findActiveContactById(cacheTriggerEventActionQueue.contactId);
                if(!contact){
                   return { success: false, message: `Unable to add tag to contact: ${cacheTriggerEventActionQueue.contactId}. Contact not found or is inactive`, errors};
                }

                /*
                * Validate tag IDs exist   
                */
                const tags = await this.findTagsByIds(tagList);

                const existingTagIds = tags.map(t => t.id);
                const validTagIds = tagList.filter(id => existingTagIds.includes(id));
                const missingTagIds = tagList.filter(id => !existingTagIds.includes(id));

                if (missingTagIds.length > 0) {
                    const errorMessage = `Tags not found: ${missingTagIds.join(', ')}`;
                    errors.push(errorMessage);
                }

                if (validTagIds.length === 0) {
                    this.logger.info('No valid tags to process');
                    return { success: true, message: 'No valid tags found to add', errors};
                }

                /**
                 * Build contact-tag data for insertion, avoiding duplicates.
                 */
                const totalTagAdded = await this.buildAndAddContactTag(user, contact as Contact, validTagIds, cacheTriggerEventActionQueue);
                if (totalTagAdded === 0) {
                    return { success: true, message: 'No new tags to add'};
                }

                return { success:  totalTagAdded > 0 , message: totalTagAdded > 0 ? 'Tags added successfully' : 'Failed to add tag to contacts'};
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Failed to add tags to contact: ${errorMessage}`,
            };
        }
    }

    private async findTagsByIds(tagIdList: bigint[]) {
        const existingTags = await this.prisma.tag.findMany({
            where: {
                id: {
                    in: tagIdList 
                }
            },
            select: {
                id: true
                }
            })
        return existingTags;
    }

    private async buildAndAddContactTag(user: BasicUser, contact: Contact, validTagIds: bigint[], cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload):
        Promise<number> {
        let totalTagAdded = 0;
        const existingContactTags = await this.prisma.contactTag.findMany({
            where: { 
                agencyId: user.agencyId,  
                userId: user.id, 
                contactId: contact.id, 
                tagId: { 
                    in: validTagIds 
                    } 
                },select: { 
                    contactId: true, 
                    tagId: true 
                },
            });
        
        const existingPairs = new Set(existingContactTags.map((ct) => `${ct.contactId.toString()}_${ct.tagId.toString()}`));

        for(const tagId of validTagIds){
            const exists = existingPairs.has(`${contact.id.toString()}_${tagId.toString()}`);
            if(exists){
                continue;
            }

            const contactTag = await this.prisma.contactTag.create({
                data: {
                    contactId: contact.id,
                    tagId: tagId,
                    userId: user.parentUserId ?? user.id,
                    agencyId: user.agencyId,
                    createdBy: user.id,
                }
            });

            totalTagAdded = contactTag ? totalTagAdded + 1 : totalTagAdded;

            await this.createActivityLog(user, contact as Contact, !contactTag, cacheTriggerEventActionQueue.triggerId, tagId);
        }

        return totalTagAdded;
    }

    private async createActivityLog(user: BasicUser, contact: Contact, success: boolean, triggerId:bigint,tagId: bigint ) {
            if(!success){
                return;
            }
            const tag = await this.prisma.tag.findFirst({
                where: { id: tagId },select: { title: true }
            })

            await createActivity({
                userId: user.parentUserId ?? user.id,
                agencyId: user.agencyId,
                createdBy: user.id,
                action: ActivityAction.ASSIGN,
                category: ActivityCategory.TRIGGER,
                description: `${tag?.title} tag was added to '${contact.firstName} ${contact.lastName}' via trigger.`,
                triggerId: triggerId
            })
    }

    /**
     * Handles errors by logging and extracting error message.
     * @param error - Error object or unknown
     * @param context - Error context message
     * @param logContext - Additional logging context
     * @returns Error message
     */
    private handleError(error: unknown, context: string, logContext: Record<string, unknown>): string {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(context, { ...logContext, error: message });
        return message;
    }
}