import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { ActivityAction, ActivityCategory, BroadcastContactStatus, Contact, ContactStatus, QueueStatus } from '@prisma/client';
import { BasicUser } from 'src/modules/user/dto/user.dto';
import { ContactService } from 'src/modules/contacts/contact.service';
import { createActivity } from '@/common/helpers/activity-log.helper';
import { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { TriggerActivityLogService } from '../trigger.activitylog.service';

/**
 * Service for managing opt-out operations for contacts.
 * Main methods at top, helper functions at bottom.
 */
@Injectable()
export class TriggerOptOutService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService,
        private readonly contactService: ContactService,
        private readonly triggerActivityLogService: TriggerActivityLogService,
    ) {
        this.logger.setContext(TriggerOptOutService.name);
    }

    /**
     * Processes an opt-out operation for a single contact.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param reason - Optional reason for opt-out
     */
    async optedOutContact(cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload, user: BasicUser): Promise<{ success: boolean; message: string }> {


        this.logger.info(`Processing opt-out for contact ${cacheTriggerEventActionQueue.contactId}`, { agencyId: user.agencyId, userId:user.id });

        // Validate contact
        const contactValidation = await this.contactService.findActiveContactById(cacheTriggerEventActionQueue.contactId);
        if (!contactValidation) {
            return { success: false, message: `Contact not found: ${cacheTriggerEventActionQueue.contactId}` };
        }

        // Check if already opted out
        const isAlreadyOptedOut = await this.checkOptOutStatus(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);
        if (isAlreadyOptedOut) {
            return { success: false, message: `Contact ${cacheTriggerEventActionQueue.contactId} already opted out` };
        }

        try {
            //Create opt-out contact
            const reason = 'Contact opted out by trigger';
            
            /**
             * opt out contact 
             */
            const optOutContactId = await this.createOptOutContact(cacheTriggerEventActionQueue.contactId, user, reason);
            
            /**
             * activity log
             */
            if(optOutContactId){
               await this.triggerActivityLogService.buildAndCreateActivityLog(
                 user,
                 ActivityAction.OPTOUT,
                 ActivityCategory.TRIGGER,
                 `${contactValidation.firstName} ${contactValidation.lastName} is opted out' via trigger.`,
                 cacheTriggerEventActionQueue.triggerId
               )
            }

            // Update contact status
            const updatedCount = await this.updateContactStatus(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);

            // Update broadcast contacts
            await this.updateBroadcastContacts(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);

            // Delete pending message queues
            await this.deletePendingMessageQueues(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);

            const message = `${updatedCount} contact opted out${updatedCount ? '' : ', 0 unchanged/skipped'}.`;
            this.logger.debug(`Opt-out complete: ${message}`, { agencyId:user.agencyId, userId:user.id });

            return { success: updatedCount > 0, message };
        } catch (error: unknown) {
            const message = this.handleError(error, `Opt-out failed`, { agencyId:user.agencyId, userId:user.id });
            return { success: false, message };
        }
    }

    // Helper Methods (grouped at the bottom)

    /**
     * Validates if a contact exists for the given agency and user.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns True if contact exists, else false
     */
    private async validateContactId(contactId: bigint, agencyId: bigint, userId: bigint): Promise<boolean> {
        const contact = await this.prisma.contact.findFirst({
            where: { id: contactId, agencyId, userId, status: ContactStatus.ACTIVE },
            select: { id: true },
        });
        return !!contact;
    }

    /**
     * Checks if a contact is already opted out or has OPT_OUT status.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns True if already opted out, else false
     */
    private async checkOptOutStatus(
        contactId: bigint,
        agencyId: bigint,
        userId: bigint,
    ): Promise<boolean> {

        const contact = await this.prisma.contact.findFirst({
            where: { id: contactId, agencyId, userId, status: ContactStatus.OPT_OUT },
            select: { status: true },
        });

        return !!contact
    }

    /**
     * Adds a contact to the optOutContact table.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param reason - Reason for opt-out
     */
    private async createOptOutContact(contactId: bigint, user: BasicUser, reason: string): Promise<BigInt> {
        const optOutContact =  await this.prisma.optOutContact.create({
            data: {
                userId: user.parentUserId || user.id,
                agencyId: user.agencyId,
                contactId,
                createdBy: user.id,
                reason,
            },
        });
        return optOutContact?.id;
    }

    /**
     * Updates a contact's status to OPT_OUT.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns Number of updated contacts
     */
    private async updateContactStatus(
        contactId: bigint,
        agencyId: bigint,
        userId: bigint,
    ): Promise<number> {
        await this.prisma.contact.update({
            where: {
                agencyId,
                userId,
                id: contactId,
            },
            data: { status: ContactStatus.OPT_OUT },
        });
        return 1
    }

    /**
     * Update all broadcast contacts for a contact.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns Number of deleted broadcast contacts
     */
    private async updateBroadcastContacts(
        contactId: bigint,
        agencyId: bigint,
        userId: bigint,
    ): Promise<number> {
        const updateResult = await this.prisma.broadcastContact.updateMany({
            where: {
                agencyId,
                userId,
                contactId,
                status: { notIn: [BroadcastContactStatus.OPT_OUT] },
            },
            data: {
                status: BroadcastContactStatus.OPT_OUT,
            },
        });
        return updateResult.count;
    }

    /**
     * Deletes all pending message queues for a contact.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns Number of deleted message queues
     */
    private async deletePendingMessageQueues(
        contactId: bigint,
        agencyId: bigint,
        userId: bigint,
    ): Promise<number> {
        const deleteResult = await this.prisma.broadcastMessageQueue.deleteMany({
            where: {
                agencyId,
                userId,
                contactId,
                status: QueueStatus.PENDING,
            },
        });
        return deleteResult.count;
    }

    private async createActivityLog(user: BasicUser,contact: Contact, success: boolean, triggerId: bigint) {
    if (!success) {
        return
    }
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