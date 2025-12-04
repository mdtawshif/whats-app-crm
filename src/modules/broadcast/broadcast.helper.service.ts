import { Injectable } from "@nestjs/common";
import { BroadcastRepository } from "./repository/broadcast.repository";
import { UserService } from "../user/user.service";
import { BroadcastMessageLogRepository } from "./repository/broadcast.message.log.repository";
import { BroadcastSettingDTO } from "./dto/broadcast.setting.dto";
import { BroadcastSettingRepository } from "./repository/broadcast.setting.repository";
import { BroadcastContactRepository } from "./repository/broadcast.contact.repository";
import { BroadcastProcessRequest } from "./broadcast.requset";
import { BroadcastType, MessageType, MessagingProduct, QueueStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { BroadcastMessageQueueDTO } from "./dto/broadcast.message.queue.dto";
import { BroadcastMessageQueueRepository } from "./repository/broadcast.message.queue.repository";
import { BroadcastService } from "./broadcast.service";

@Injectable()
export class BroadcastHelperService{
    constructor(
        private readonly broadcastRepository: BroadcastRepository,
        private readonly userService: UserService,
        private readonly broadcastMessageLogRepository: BroadcastMessageLogRepository,
        private readonly broadcastSettingRepository: BroadcastSettingRepository,
        private readonly broadcastContactRepository: BroadcastContactRepository,
        private readonly broadcastMessageQueueRepository: BroadcastMessageQueueRepository,
        private readonly broadcastService: BroadcastService,
    ){}

    async findBroadcastById(broadcastId: bigint){
       return await this.broadcastRepository.findBroadcastById(broadcastId);
    }

    async findUserById(userId: bigint){
       return await this.userService.findById(userId);
    }

    async findBroadcastContactLastSettingId(broadcastId: bigint, contactId: bigint):Promise<BroadcastSettingDTO>{
        return await this.broadcastMessageLogRepository.findLastBroadcastSetting(broadcastId, contactId);
    }

    async findBroadcastRecurringSettings(broadcastId: bigint):Promise<BroadcastSettingDTO[]>{
        return await this.broadcastSettingRepository.findBroadcastRecurringSettings(broadcastId);
    }

    async findBroadcastContact(broadcastId: bigint, contactId: bigint){
       return await this.broadcastContactRepository.findBroadcastContact(broadcastId, contactId);
    }

    //find contact by id
    async findContactById(contactId: bigint){
        return await this.broadcastContactRepository.findContactById(contactId);
    }

    async findFirstBroadcastSetting(broadcastId: bigint, priority: number){
        return await this.broadcastSettingRepository.findFirstBroadcastSetting(broadcastId, priority);
    }

    async buildBroadcastQueue(broadcastProcessRequest: BroadcastProcessRequest, scheduleDate: DateTime){
        const hasEntry = await this.hasResponseQueueEntry(broadcastProcessRequest);
        if(hasEntry){
            return null;
        }

        const broadcastMessageQueueDTO = {
            agencyId: broadcastProcessRequest.user.agencyId,
            userId: broadcastProcessRequest.user.id,
            contactId: broadcastProcessRequest.broadcastContact.contactId,
            broadcastId: broadcastProcessRequest.broadcast.id,
            broadcastSettingId: broadcastProcessRequest.broadcastSettingDTO.id,
            waBusinessNumberId: broadcastProcessRequest.broadcastSettingDTO.waBusinessNumberId,
            status: QueueStatus.PENDING,
            sentAt: scheduleDate,
            failedReason: null,
            response: null,
            messageType: broadcastProcessRequest.broadcastSettingDTO.messageTemplateId ? MessageType.TEMPLATE: MessageType.TEXT,
            messagingProduct: MessagingProduct.WHATS_APP
        }
        return broadcastMessageQueueDTO;
    }

    async addBroadcstMessageQueues(broadcastMessageQueues:BroadcastMessageQueueDTO[]){
        console.log("broadcastMessageQueues", broadcastMessageQueues);
        return await this.broadcastMessageQueueRepository.addBroadcastMessageQueueInBatch(broadcastMessageQueues);
    }

    async hasBroasstMessageLog(broadcastId: bigint, contactId: bigint, broadcastSettingId: bigint){
        return await this.broadcastMessageLogRepository.hasMessageLogEntry(broadcastId, contactId, broadcastSettingId);
    }


    /**
     * 
     * @param broadcastProcessRequest 
     * @returns 
     */
    async hasResponseQueueEntry(broadcastProcessRequest: BroadcastProcessRequest): Promise<boolean>{
        const hasMessageLogEntry = await this.broadcastMessageLogRepository.hasMessageLogEntry(broadcastProcessRequest.broadcast.id,
            broadcastProcessRequest.broadcastContact.contactId, broadcastProcessRequest.broadcastSettingDTO.id
        );
        if(hasMessageLogEntry && broadcastProcessRequest.broadcastSettingDTO.broadcastType !=BroadcastType.RECURRING){
            return true;
        }

        const hasQueueEntry = await this.broadcastMessageQueueRepository.hasMessageQueueEntry(broadcastProcessRequest.broadcast.id,
            broadcastProcessRequest.broadcastContact.contactId, broadcastProcessRequest.broadcastSettingDTO.id
        );
        return hasQueueEntry;
    }

    async pauseBroadcastForInsufficientCredit(id: bigint, data: any): Promise<boolean>{
        return await this.broadcastService.update(id, data);
    }

    async changeBroadcastStatus(id: bigint, data: any) {
        return await this.broadcastService.update(id, data);
    }

    async findLastSentRecurringSetting(broadcastId: bigint, contactId: bigint, broadcastSettingId: bigint) {
        return await this.broadcastMessageLogRepository.findLastSentRecurringSetting(broadcastId, contactId, broadcastSettingId);
    } 
    
}