import { Injectable } from "@nestjs/common";
import { BroadcastContactStatus, BroadcastStatus, ContactForwardQueue, ContactForwardQueueStatus, UserStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { error } from "console";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { UserService } from "src/modules/user/user.service";
import { ContactForwardSchedulerHelperService } from "./forward.scheduler.helper.service";
import { ContactForwardScheduler } from "./contact.forward.scheduler";


/**
 * @author @Milton
 */
@Injectable()
export class ContactForwardSchedulerWorker {

    constructor(
        private readonly logger: PinoLogger,
        private readonly broadcastHelperService: BroadcastHelperService,
        private readonly contactForwardSchedulerHelperService: ContactForwardSchedulerHelperService,
        private readonly contactForwardScheduler: ContactForwardScheduler
    ){
        this.logger.setContext(ContactForwardSchedulerWorker.name);
    }


    async processSchedulerForwardQueue(contactForwardQueue: ContactForwardQueue){

        let broadcastProcessRequest = {
          success: true,
          broadcastSettingDTO: null,
          broadcast: null,
          broadcastContact: null,
          broadcastId: null,
          user: null
        }

        const isAbleToSchedule = await this.isAbleToScheduleForwardQueue(contactForwardQueue, broadcastProcessRequest)
        console.error("isAbleToSchedule", isAbleToSchedule);
        if (!isAbleToSchedule) {
            await this.updateStatus([contactForwardQueue.id], broadcastProcessRequest);
            return;
        }

        await this.contactForwardScheduler.scheduleNextPriorityForwardQueue(contactForwardQueue, broadcastProcessRequest);

        const queueIds = [contactForwardQueue.id];
        await this.updateStatus(queueIds, broadcastProcessRequest);
    }


    private async isAbleToScheduleForwardQueue(contactForwardQueue: ContactForwardQueue, broadcastProcessRequest: BroadcastProcessRequest): Promise<boolean>{
        broadcastProcessRequest.success = false;

        const user = await this.broadcastHelperService.findUserById(contactForwardQueue.userId);
        if(!user || user.status!=UserStatus.ACTIVE){
            broadcastProcessRequest.errorMessage ='User either does not exist or is not active'
            return false;
        }
        broadcastProcessRequest.user = user;

        const broadcast = await this.broadcastHelperService.findBroadcastById(contactForwardQueue.broadcastId);
        if(!broadcast || broadcast.status != BroadcastStatus.RUNNING){
            broadcastProcessRequest.errorMessage = `Broadcast [ID: ${contactForwardQueue.broadcastId}] is missing or inactive. Forwarding not possible.`;
            return false;
        }
        broadcastProcessRequest.broadcast = broadcast;
        if(broadcast.timeZone == null){
            broadcast.timeZone = user.timeZone;
        }

        const isValidBroadcastContact = await this.isValidBroadcastContact(contactForwardQueue, broadcastProcessRequest);
        if(!isValidBroadcastContact){
            return false;
        }

        broadcastProcessRequest.success = true;
        return true;
    }

    /**
     * @validate broadcast contact
     * @param contactForwardQueue 
     * @param broadcastProcessRequest 
     * @returns 
     */
    private async isValidBroadcastContact(contactForwardQueue: any, broadcastProcessRequest: any): Promise<boolean> {
        const contact = await this.contactForwardSchedulerHelperService.findContactById(contactForwardQueue.contactId);

        const broadcastContact = await this.broadcastHelperService.findBroadcastContact(contactForwardQueue.broadcastId, contactForwardQueue.contactId);
        if (!broadcastContact) {
            broadcastProcessRequest.errorMessage =`Contact [ID: ${contactForwardQueue.contactId}] not found in Broadcast [ID: ${contactForwardQueue.broadcastId}].`;
            return false;
        }

        if (broadcastContact.status === BroadcastContactStatus.OPT_OUT ||
            broadcastContact.status === BroadcastContactStatus.UNSUBSCRIBE) {
            broadcastProcessRequest.errorMessage = `Contact [ID: ${contactForwardQueue.contactId}] has opted out or unsubscribed from Broadcast [ID: ${contactForwardQueue.broadcastId}].`;
            return false;
        }

        if (broadcastContact.status !== BroadcastContactStatus.RUNNING) {
            broadcastProcessRequest.errorMessage =`Contact [ID: ${contactForwardQueue.contactId}] is not active in Broadcast [ID: ${contactForwardQueue.broadcastId}].`;
            return false;
        }
        broadcastProcessRequest.broadcastContact = broadcastContact;
        return true;
    }



    private async updateStatus(ids: bigint[], broadcastProcessRequest: BroadcastProcessRequest){
        const data = {
            status: broadcastProcessRequest.success ? ContactForwardQueueStatus.COMPLETED : ContactForwardQueueStatus.FAILED,
            failedReason: broadcastProcessRequest.success ? '' : broadcastProcessRequest.errorMessage
        }
        await this.contactForwardSchedulerHelperService.updateForwardQueuesByIds(ids, data);
    }

}