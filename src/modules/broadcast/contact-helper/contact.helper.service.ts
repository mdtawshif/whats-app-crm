import { BroadcastMessageQueue, ContactPauseResumeRequestStatus, OptOutContact } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { ContactPauseResumeRequestRepository } from "../repository/contact.pause.resume.repository";
import { Injectable } from "@nestjs/common";
import { BroadcastContactRepository } from "../repository/broadcast.contact.repository";
import { BroadcastMessageQueueRepository } from "../repository/broadcast.message.queue.repository";
import { OptOutService } from "src/modules/opt-out/opt-out.service";
import { OptOutContactDTO } from "src/modules/opt-out/dto/optout.contact.dto";
import { BasicUser } from '../../user/dto/user.dto';

/**
 * @author @Milton
 */
@Injectable()
export class ContactHelperService {

    constructor(
        private readonly contactPauseResumeRequestRepository: ContactPauseResumeRequestRepository,
        private readonly broadcastContactRepository: BroadcastContactRepository,
        private readonly broadcastMessageQueueRepository: BroadcastMessageQueueRepository,
        private readonly optoutContactService: OptOutService
    ){}


    async findPendingPauseResumeRequests(id:bigint, limit:number){
        return await this.contactPauseResumeRequestRepository.findPendingPauseResumeRequests(id, limit);
    }
    
    async updatecontactPauseResumeRequestByIds(ids: bigint[], data: any){
        return await this.contactPauseResumeRequestRepository.updateByIds(ids, data);
    }

    async updateBroadcastAndContact(broadcastId: bigint, contactId: bigint, data: any){
        return await this.broadcastContactRepository.updateByBroadcastAndContact(broadcastId, contactId, data);
    }

    async removeBroadcastContactQueue(broadcastId: bigint, contactId: bigint){
        await this.broadcastMessageQueueRepository.removeBroadcastContactQueue(broadcastId, contactId);
    }

    async addOptoutContact(user: BasicUser, optoutContact: OptOutContactDTO){ 
        return await this.optoutContactService.optOutContact(user, optoutContact);
    }

}