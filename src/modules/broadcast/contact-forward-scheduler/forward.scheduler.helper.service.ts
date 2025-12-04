import { Inject, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { ContactForwardQueueRepository } from "../repository/contact.forward.queue.repository";
import { ContactRepository } from "../repository/contact.repository";
import { BroadcastSettingRepository } from "../repository/broadcast.setting.repository";

@Injectable()
export class ContactForwardSchedulerHelperService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
        private readonly contactForwardQueueRepository: ContactForwardQueueRepository,
        private readonly contactRepository: ContactRepository,
        private readonly broadcastSettingRepository: BroadcastSettingRepository,
    ){
        this.logger.setContext(ContactForwardSchedulerHelperService.name);
    }

    async findPendingForwardQeues(id: bigint, limit:number){
        return await this.contactForwardQueueRepository.findPendingQueues(id, limit);
    }

    async updateForwardQueuesByIds(id: bigint[], data: any){
        return await this.contactForwardQueueRepository.updateByIds(id, data);
    }

    async findContactById(contactId: bigint){
        return await this.contactRepository.findActiveContactById(contactId);
    }

    async findCompleteBroadcastSetting(broadcastSettingId: bigint){
        return await this.broadcastSettingRepository.findBroadcastSettingById(broadcastSettingId);
    }

    async findHigherPriorityForwardSetting(broadcastId: bigint, priority: number){
        return await this.broadcastSettingRepository.findHigherPriorityForwardSetting(broadcastId, priority);
    }


}