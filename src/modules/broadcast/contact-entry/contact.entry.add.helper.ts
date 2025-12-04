import { Injectable } from "@nestjs/common";
import { ContactEntryHelperService } from "./contact.entry.helper.service";
import { PinoLogger } from "nestjs-pino";
import { BroadcastContactEntryQueue, BroadcastContactQueueSource, BroadcastContactSource, BroadcastContactStatus, UserStatus, type Contact } from "@prisma/client";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { ContactEntrySchedulerService } from "./contact.entry.scheduler.service";
import { BroadcastService } from "../broadcast.service";
import { TriggerEventManager } from "../../trigger/services/trigger-event-manager/trigger-event-manager.service";
import { EventKeys } from "src/types/triggers";
import { getContactDisplayName } from "@/utils/contact";

/**
 * @author @Milton
 */
@Injectable()
export class ContactEntryAddHelper {

    constructor(
        private readonly contactEntryHelperService: ContactEntryHelperService,
        private readonly broadcastHelperService: BroadcastHelperService,
        private readonly logger: PinoLogger,
        private readonly contactEntrySchedulerService: ContactEntrySchedulerService,
        private readonly broadcastService: BroadcastService,
        private readonly triggerEventManager: TriggerEventManager
    ) {
        this.logger.setContext(ContactEntryAddHelper.name);
    }

    /**
     * @Process to add contact to broadcast
     * @param broadcastContactEntryRequest 
     * @param broadcastProcessRequest 
     * @returns 
     */
    async addContactToBroadcast(broadcastContactEntryRequest: BroadcastContactEntryQueue, broadcastProcessRequest: BroadcastProcessRequest) {

        /**
         * @Check already exists or not
         */
        const broadcastContact = await this.broadcastHelperService.findBroadcastContact(broadcastContactEntryRequest.broadcastId, broadcastContactEntryRequest.contactId);
        if (broadcastContact) {
            broadcastProcessRequest.success = false,
                broadcastProcessRequest.errorMessage = `Contact :${broadcastContactEntryRequest.contactId} is already exists in broadcat: ${broadcastContactEntryRequest.broadcastId}`;
            return;
        }

        console.log("broadcastContactEntryRequest: ", broadcastContactEntryRequest);
        console.log("broadcastContact: ", broadcastContact);

        /**
         * @Add contact to broadcast
         */
        const broadcastContactDTO = await this.buildBroadcastContact(broadcastContactEntryRequest, broadcastProcessRequest);
        console.log("broadcastContactDTO: ", broadcastContactDTO);
        const broadcastContactAddResponse = await this.contactEntryHelperService.addBroadcastContact(broadcastContactDTO);
        console.log("broadcastContactId: ", broadcastContactAddResponse);
        if (broadcastContactAddResponse === null) {
            broadcastProcessRequest.success = false;
            broadcastProcessRequest.errorMessage = `Failed to add Contact :${broadcastContactEntryRequest.contactId} to broadcat: ${broadcastContactEntryRequest.broadcastId}`;
            return;
        }
        broadcastProcessRequest.broadcastContact = broadcastContactAddResponse;


        //get contact by id for trigger payload
        const contact = await this.broadcastHelperService.findContactById(broadcastContactAddResponse.contactId);
        // Trigger event queue create for contact_added_to_broadcast
        await this.triggerEventManager.createTriggerEventQueue({
            agencyId: broadcastContactAddResponse.agencyId,
            userId: broadcastContactAddResponse.userId,
            contactId: broadcastContactAddResponse.contactId,
            eventKey: EventKeys.CONTACT_ADDED_TO_BROADCAST,
            payload: {
                contact: { displayName: getContactDisplayName(contact as Contact), number: contact.number },
                broadcastId: broadcastContactAddResponse.broadcastId
            }
        });


        await this.broadcastService.updateBroadcastSummaryTotalContact(broadcastContactEntryRequest.broadcastId);

        await this.contactEntrySchedulerService.scheduleQueue(broadcastProcessRequest);
    }

    /**
     * @build broadcast contact
     * @param broadcastContactEntryQueue 
     * @param broadcastProcessRequest 
     * @returns 
     */
    private async buildBroadcastContact(broadcastContactEntryQueue: BroadcastContactEntryQueue, broadcastProcessRequest: BroadcastProcessRequest) {
        const broadcastContactDTO = {
            agencyId: broadcastProcessRequest.user.agencyId,
            teamId: broadcastProcessRequest.user.teamId,
            userId: broadcastProcessRequest.user.id,
            broadcastId: broadcastContactEntryQueue.broadcastId,
            contactId: broadcastContactEntryQueue.contactId,
            contactSource: this.mapBroadcastContactSource(
                broadcastContactEntryQueue.contactSource
            ),
            entryDate: new Date(),
            status: BroadcastContactStatus.RUNNING,
            lastMessageAt: null,
            nextAllowedMessageAt: null
        }
        return broadcastContactDTO
    }

    private mapBroadcastContactSource(contactSource: BroadcastContactQueueSource): BroadcastContactSource {
        return BroadcastContactSource[contactSource as keyof typeof BroadcastContactSource]
    }

}