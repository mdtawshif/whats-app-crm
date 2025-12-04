import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import {
    ActivityAction,
    ActivityCategory,
    BroadcastContactQueueSource,
    BroadcastContactSource,
    BroadcastContactStatus,
    BroadcastStatus,
    ContactStatus,
    QueueStatus,
    type Contact,
} from '@prisma/client';
import { TriggerEventManager } from '../trigger-event-manager/trigger-event-manager.service';
import { EventKeys } from 'src/types/triggers';
import type { TriggerExecutionResult } from '../../interfaces/trigger.interface';
import { getContactDisplayName } from '@/utils/contact';

import { BroadcastContactStatusTriggerAction } from 'src/types/triggers/broadcast-action-executor.types';
import { BasicUser } from 'src/modules/user/dto/user.dto';
import { add } from 'lodash';
import { triggerAsyncId } from 'async_hooks';
import { createActivity } from '@/common/helpers/activity-log.helper';
import { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';
import { TriggerActivityLogService } from '../trigger.activitylog.service';
/**
 * Service for managing broadcast operations (pause, unsubscribe, add contact).
 * Main methods at top, helper functions at bottom.
 */
@Injectable()
export class TriggerBroadcastService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService,
        private readonly triggerEventManager: TriggerEventManager,
        private readonly triggerActivityLogService: TriggerActivityLogService,
    ) {
        this.logger.setContext(TriggerBroadcastService.name);
    }

    /**
     * Processes bulk pause or unsubscribe for a contact across all active broadcasts.
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param contactId - Contact ID
     * @param action - BroadcastContactStatus
     */
    async pauseOrUnsubContactFromAllBroadcasts(action: BroadcastContactStatusTriggerAction,
            user: BasicUser,
            cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
    ): Promise<TriggerExecutionResult> {
        const actionText = action.toLowerCase();
        this.logger.info(`Processing bulk broadcast ${actionText} for contact ${cacheTriggerEventActionQueue.contactId}`, { agencyId:user.agencyId, userId:user.id });


        if (![BroadcastContactStatus.PAUSED, BroadcastContactStatus.UNSUBSCRIBE].includes(action)) {
            return { success: false, message: `Invalid action: ${action}` };
        }

        const contactExists = await this.validateContactId(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);
        if (!contactExists) {
            return { success: false, message: `Contact not found or inactive: ${cacheTriggerEventActionQueue.contactId}` };
        }

        try {
            const excludeStatuses: BroadcastContactStatus[] = [BroadcastContactStatus.UNSUBSCRIBE];
            if (action === BroadcastContactStatus.PAUSED) {
                excludeStatuses.push(BroadcastContactStatus.PAUSED);
            }

            // Update all broadcast contacts
            const updateResultCount = await this.updateBulkBroadcastContactStatus(user.agencyId, user.id, cacheTriggerEventActionQueue.contactId, action, excludeStatuses);

            // Delete all pending message queues
            await this.deleteBulkPendingMessageQueues(user.agencyId, user.id, cacheTriggerEventActionQueue.contactId);

            /**
             * activity log
             */
            if(updateResultCount > 0){
               await this.triggerActivityLogService.buildAndCreateActivityLog(
                 user,
                 action === BroadcastContactStatus.UNSUBSCRIBE ? ActivityAction.UNSUBSCRIBE : ActivityAction.PAUSE,
                 ActivityCategory.TRIGGER,
                 `${contactExists.firstName} ${contactExists.lastName} was ${actionText}d from ${updateResultCount} broadcasts via trigger.`,
                 cacheTriggerEventActionQueue.triggerId
               )
            }

            return { success: true, message: `${updateResultCount} ${actionText}${updateResultCount ? '' : ', 0 unchanged/skipped'}.` };
        } catch (error: unknown) {
            const message = this.handleError(error, `Bulk ${actionText} failed`, { agencyId:user.agencyId, userId: user.id });
            return { success: false, message };
        }
    }

    /**
     * Processes pause or unsubscribe for specific broadcast-contact pairs.
     * @param action - PAUSED or UNSUBSCRIBE
     * @param broadcastIds - Array of broadcast IDs
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     */
    async pauseOrUnsubContactFromBroadcast(action: BroadcastContactStatusTriggerAction,
            user: BasicUser,
            cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload,
            broadcastId: string,

    ): Promise<TriggerExecutionResult> {

        const operationText = action === BroadcastContactStatus.UNSUBSCRIBE ? 'unsubscribe' : 'pause';
        this.logger.info(`Processing  ${operationText} contact ${cacheTriggerEventActionQueue.contactId} from broadcast`, {
            broadcastCount: broadcastId ? 1 : 0,
            contactId: cacheTriggerEventActionQueue.contactId,
            agencyId: user.agencyId,
            userId: user.id,
        });

        // Validate action
        if (![BroadcastContactStatus.PAUSED, BroadcastContactStatus.UNSUBSCRIBE].includes(action)) {
            return { success: false, message: `Invalid action: ${action}` };
        }

        // Convert broadcastIds to bigint
        const broadcastIdBigInt = this.toBigInt(broadcastId);

        // Validate contact
        const contactExists = await this.validateContactId(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);
        if (!contactExists) {
            return { success: false, message: `Contact not found: ${cacheTriggerEventActionQueue.contactId}` };
        }

        // Validate broadcasts
        const missingBroadcast = await this.validateBroadcastId(broadcastIdBigInt, user.agencyId, user.id);
        if (!missingBroadcast) {
            return { success: false, message: `Broadcasts not found: ${broadcastId}` };
        }


        try {
            // Exclude UNSUBSCRIBE and PAUSED
            const excludeStatuses: BroadcastContactStatus[] = [BroadcastContactStatus.UNSUBSCRIBE];
            if (action === BroadcastContactStatus.PAUSED) {
                excludeStatuses.push(BroadcastContactStatus.PAUSED);
            }

            // Update broadcast contacts
            const updateResultCount = await this.updateBroadcastContactStatus(user.agencyId, user.id, cacheTriggerEventActionQueue.contactId, broadcastIdBigInt, action, excludeStatuses);

            // Delete pending message queues
            await this.deletePendingMessageQueues(user.agencyId, user.id, cacheTriggerEventActionQueue.contactId, broadcastIdBigInt);

            /**
             * activity log
             */
             if(updateResultCount > 0){
              const actionText = action === BroadcastContactStatus.UNSUBSCRIBE ? 'unsubscribe' : 'pause';
               await this.triggerActivityLogService.buildAndCreateActivityLog(
                 user,
                 action === BroadcastContactStatus.UNSUBSCRIBE ? ActivityAction.UNSUBSCRIBE : ActivityAction.PAUSE,
                 ActivityCategory.TRIGGER,
                 `${contactExists.firstName} ${contactExists.lastName} was ${actionText}d from ${missingBroadcast.title}! via trigger.`,
                 cacheTriggerEventActionQueue.triggerId
               )
            }

            return { success: updateResultCount > 0, message: `${updateResultCount} ${operationText}${updateResultCount ? '' : ', 0 unchanged/skipped'}.` };
        } catch (error: unknown) {
            const message = this.handleError(error, `Broadcast ${operationText} failed`, { agencyId:user.agencyId, userId:user.id });
            return { success: false, message };
        }
    }

    /**
     * Adds a contact to a broadcast based on its status.
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param contactId - Contact ID
     * @param broadcastId - Broadcast ID
     */
    async addContactToBroadcast(user: BasicUser, cacheTriggerEventActionQueue: CacheTriggerEventActionQueueWithPayload, broadcastId: bigint): Promise<TriggerExecutionResult> {

        const contactExists = await this.validateContactId(cacheTriggerEventActionQueue.contactId, user.agencyId, user.id);
        if (!contactExists) {
            return { success: false, message: `Contact not found or not active: ${cacheTriggerEventActionQueue.contactId}` };
        }

        const broadcastExists = await this.validateBroadcastId(broadcastId, user.agencyId, user.id);
        if (!broadcastExists) {
            return { success: false, message: `Broadcast not found : ${broadcastId}` };
        }
        const broadcastStatus = broadcastExists.status;

        try {

            const exists = await this.checkExistingBroadcastContact(user.agencyId, user.id,cacheTriggerEventActionQueue.contactId, broadcastId);
            if (exists) {
                return { success: false, message: `Contact ${cacheTriggerEventActionQueue.contactId} already in broadcast ${broadcastId}` };
            }

            const validStatuses = [BroadcastStatus.PAUSED, BroadcastStatus.ACTIVE, BroadcastStatus.PAUSED_FOR_CREDIT] as BroadcastStatus[];
            const broadcastTitle = broadcastExists.title;
            /**
             * add contact to broadcast directly if status is PAUSED, ACTIVE, PAUSED_FOR_CREDITs
             */
            if (validStatuses.includes(broadcastStatus)) {
                const broadcastContact = await this.addTOBroadcastContact(user, cacheTriggerEventActionQueue.contactId, broadcastId);
                await this.createActivityLog(user, broadcastExists.title, contactExists as Contact, true, cacheTriggerEventActionQueue.triggerId );
                await this.addTOTriggerEventQueue(user, cacheTriggerEventActionQueue.contactId, broadcastId, contactExists as Contact);
                return { success: true, message: `1 contact added to broadcast` };
            } 
            
            /**
             * @add contact to broadcast entry queue if status is RUNNING
             */
            if (broadcastStatus === BroadcastStatus.RUNNING) {
                await this.addToBroadcastContactEntryQueue(user, cacheTriggerEventActionQueue.contactId, broadcastId);
                return { success: true, message: `1 contact added to broadcast queue` };
            }

            return { success: false, message: `Invalid broadcast status: ${broadcastStatus}` };
        } catch (error: unknown) {
            const message = this.handleError(error, `Add contact to broadcast failed`, { agencyId: user.agencyId, userId: user.id});
            return { success: false, message };
        }
    }

    private async addTOBroadcastContact(user: BasicUser, contactId: bigint, broadcastId: bigint) {
        const broadcastContact = await this.prisma.broadcastContact.create({
            data: {
                agencyId: user.agencyId,
                userId: user.id,
                contactId,
                broadcastId,
                status: BroadcastContactStatus.RUNNING,
                contactSource: BroadcastContactSource.SINGLE,
                entryDate: new Date(),
            },
        });

        return broadcastContact;
    }

    private async addTOTriggerEventQueue(user: BasicUser, contactId: bigint, broadcastId: bigint, contactExists:Contact) {
        await this.triggerEventManager.createTriggerEventQueue({
            agencyId: user.agencyId,
            userId: user?.parentUserId || user.id,
            contactId,
            eventKey: EventKeys.CONTACT_ADDED_TO_BROADCAST,
            payload: {
                contact: { displayName: getContactDisplayName(contactExists as Contact), number: contactExists.number },
                broadcastId,
                },
            });
    }

    private async addToBroadcastContactEntryQueue(user: BasicUser, contactId: bigint, broadcastId: bigint) {
        await this.prisma.broadcastContactEntryQueue.create({
            data: {
            agencyId: user.agencyId,
            userId: user.id,
            createdBy: user.id,
            contactId,
            broadcastId,
            status: QueueStatus.PENDING,
            contactSource: BroadcastContactQueueSource.CONTACT,
          },
        });
    }

    /**
 * Updates the status of all broadcast contacts for a given contact in bulk.
 * @param agencyId - Agency ID
 * @param userId - User ID
 * @param contactId - Contact ID
 * @param targetStatus - Target status (PAUSED or UNSUBSCRIBE)
 * @param excludeStatuses - Statuses to exclude from update
 * @returns Number of updated broadcast contacts
 */
    private async updateBulkBroadcastContactStatus(
        agencyId: bigint,
        userId: bigint,
        contactId: bigint,
        targetStatus: BroadcastContactStatusTriggerAction,
        excludeStatuses: BroadcastContactStatus[],
    ): Promise<number> {
        const updateResult = await this.prisma.broadcastContact.updateMany({
            where: {
                agencyId,
                userId,
                contactId,
                status: { notIn: excludeStatuses },
            },
            data: { status: targetStatus },
        });
        return updateResult.count;
    }

    /**
     * Deletes all pending message queues for a contact in bulk.
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param contactId - Contact ID
     * @returns Number of deleted message queues
     */
    private async deleteBulkPendingMessageQueues(
        agencyId: bigint,
        userId: bigint,
        contactId: bigint,
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
    /**
   * Updates the status of a broadcast contact for a given contact and broadcast.
   * @param agencyId - Agency ID
   * @param userId - User ID
   * @param contactId - Contact ID
   * @param broadcastId - Broadcast ID
   * @param targetStatus - Target status (PAUSED or UNSUBSCRIBE)
   * @param excludeStatuses - Statuses to exclude from update
   * @returns Number of updated broadcast contacts (1 or 0)
   */
    private async updateBroadcastContactStatus(
        agencyId: bigint,
        userId: bigint,
        contactId: bigint,
        broadcastId: bigint,
        targetStatus: BroadcastContactStatusTriggerAction,
        excludeStatuses: BroadcastContactStatus[],
    ): Promise<number> {
        const updateResult = await this.prisma.broadcastContact.update({
            where: {
                uniq_broadcast_contact: { contactId, broadcastId },
                agencyId,
                userId,
                contactId,
                broadcastId,
                status: { notIn: excludeStatuses },
            },
            data: { status: targetStatus },
        });
        return updateResult ? 1 : 0;
    }

    /**
     * Deletes pending message queues for a contact and a specific broadcast.
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param contactId - Contact ID
     * @param broadcastId - Broadcast ID
     * @returns Number of deleted message queues
     */
    private async deletePendingMessageQueues(
        agencyId: bigint,
        userId: bigint,
        contactId: bigint,
        broadcastId: bigint,
    ): Promise<number> {
        const deleteResult = await this.prisma.broadcastMessageQueue.deleteMany({
            where: {
                agencyId,
                userId,
                contactId,
                broadcastId,
                status: QueueStatus.PENDING,
            },
        });
        return deleteResult.count;
    }

    /**
     * Converts string or bigint IDs to bigint for Prisma compatibility.
     * @param ids - Array of IDs (string or bigint)
     * @returns Array of bigint IDs
     */
    private toBigInt(id: string | bigint) {
        return typeof id === 'string' ? BigInt(id) : id;
    }

    /**
     * Validates if a contact exists for the given agency and user.
     * @param contactId - Contact ID
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns True if contact exists, else false
     */
    private async validateContactId(contactId: bigint, agencyId: bigint, userId: bigint) {
        const contact = await this.prisma.contact.findFirst({
            where: { id: contactId, agencyId, userId, status: ContactStatus.ACTIVE },
            select: { id: true, firstName: true, lastName: true, number: true },
        });
        return contact;
    }

    /**
     * Validates if broadcast IDs exist for the given agency and user.
     * @param broadcastIds - Array of broadcast IDs
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @returns Array of missing broadcast IDs
     */
    private async validateBroadcastId(broadcastId: bigint, agencyId: bigint, userId: bigint): Promise<{ id: bigint; status: BroadcastStatus, title:string } | null> {
        const existingBroadcast = await this.prisma.broadcast.findFirst({
            where: { id: broadcastId, agencyId, userId },
            select: { id: true, status: true, title:true },
        });
        return existingBroadcast
    }


   
    /**
     * Checks if a contact is already in a broadcast with RUNNING status.
     * @param agencyId - Agency ID
     * @param userId - User ID
     * @param contactId - Contact ID
     * @param broadcastId - Broadcast ID
     * @returns True if exists, else false
     */
    private async checkExistingBroadcastContact(
        agencyId: bigint,
        userId: bigint,
        contactId: bigint,
        broadcastId: bigint,
    ): Promise<boolean> {
        const existing = await this.prisma.broadcastContact.findFirst({
            where: { agencyId, userId, contactId, broadcastId },
            select: { id: true },
        });
        return !!existing;
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

    private async createActivityLog(user: BasicUser, broadcastTitle: string, contact: Contact, success: boolean, triggerId:bigint ) {
        if(!success){
            return;
        }
        
        await createActivity({
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            createdBy: user.id,
            action: ActivityAction.ASSIGN,
            category: ActivityCategory.TRIGGER,
            description: `${contact.firstName} ${contact.lastName} was added to broadcast '${broadcastTitle.trim()}'" via trigger.`,
            triggerId: triggerId
        })
    }
}