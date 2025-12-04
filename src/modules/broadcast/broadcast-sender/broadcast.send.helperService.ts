import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { BroadcastMessageQueueRepository } from "../repository/broadcast.message.queue.repository";
import { ContactRepository } from "../repository/contact.repository";
import { OptOutService } from "src/modules/opt-out/opt-out.service";
import { BroadcastSettingRepository } from "../repository/broadcast.setting.repository";
import { WaBusinessNumberService } from "src/modules/whatsapp/service/wa.business.number.service";
import { MessageTemplateService } from "src/modules/whatsapp/service/wa.message.template.service";
import { BroadcastMessageLogRepository } from "../repository/broadcast.message.log.repository";
import { BroadcastMessageLogDTO } from "../dto/broadcast.messagelog.dto";
import { WaBusinessAccountService } from "src/modules/whatsapp/service/wa.business.account.service";
import { FbBusinessAccountService } from "src/modules/whatsapp/service/fb.business.account.service";
import { BroadcastSettingStatsCreateDto, ContactForwardQueueDTO } from "../dto/broadcast.dto";
import { ContactForwardQueueRepository } from "../repository/contact.forward.queue.repository";
import { BroadcastSettingStatsRepository } from "../repository/broadcast.setting.stats.repository";
import { BroadcastSettingStatsDTO } from "../dto/broadcast.sequence.stats.dto";
import { BroadcastContactRepository } from "../repository/broadcast.contact.repository";
import { BroadcastRepository } from "../repository/broadcast.repository";

/**
 * @Milton463
 */
@Injectable()
export class BroadcastSendHelperService {
    
    constructor(
        private readonly logger: PinoLogger,
        private readonly broadcastMessageQueueRepository: BroadcastMessageQueueRepository,
        private readonly contactRepository: ContactRepository,
        private readonly optOutService: OptOutService,
        private readonly broadcastSettingRepository: BroadcastSettingRepository,
        private readonly waBusinessNumberService: WaBusinessNumberService,
        private readonly messageTemplateService: MessageTemplateService,
        private readonly broadcastMessageLogRepository: BroadcastMessageLogRepository,
        private readonly waBusinessAccountService: WaBusinessAccountService,
        private readonly fbBusinessAccountService: FbBusinessAccountService,
        private readonly contactForwardQueueRepository: ContactForwardQueueRepository,
        private readonly broadcastSettingStatRepository: BroadcastSettingStatsRepository,
        private readonly broadcastContactRepository: BroadcastContactRepository,
        private readonly broadcastRepository: BroadcastRepository,
    ){}

    async findPendingBroadcastMessageQueues(id: bigint, limit: number){
        return await this.broadcastMessageQueueRepository.findPendingQueues(id, limit);
    }

    async changeBroadcastMessageQueueStatus(ids: bigint[], data: any){
        return await this.broadcastMessageQueueRepository.updateByIds(ids, data);
    }

    async findContactById(contactId: bigint){
        return await this.contactRepository.findActiveContactById(contactId);
    }

    async isContactOptedOut(userId: bigint, contactId: bigint){
        return await this.optOutService.isContactOptedOut(userId, contactId);
    }

    async findBroadcastSettingById(broadcastSettingId: bigint){
        return await this.broadcastSettingRepository.findBroadcastSettingById(broadcastSettingId);
    }

    async getMessageTemplateById(messageTemplateId: bigint){
        return await this.messageTemplateService.getMessageTemplateById(messageTemplateId);
    }

    async getNumberDataById(waBusinessNmberId: bigint){
        return await this.waBusinessNumberService.getNumberDataById(waBusinessNmberId);
    }

    async getWaBusinessNumberDataById(waBusinessNmberId: bigint){
        return await this.waBusinessNumberService.getWaNumberDataById(waBusinessNmberId);
    }
    
    async addBroadcastMessageLog(broadcastMessageLogDTO: BroadcastMessageLogDTO){
        return await this.broadcastMessageLogRepository.addBroadcastMessageLog(broadcastMessageLogDTO);
    }
     
    async findWaBusinessAccount(waBusinessAccountId: bigint){
        return await this.waBusinessAccountService.findWaBusinessAccountById(waBusinessAccountId);
    }

    async findFBBusinessAccount(fbBusinessAccountId: bigint){
        return await this.fbBusinessAccountService.findFBBusinessAccountById(fbBusinessAccountId);
    }

    async addContactForwardQueue(contactForwardQueueDTO: ContactForwardQueueDTO){
        return await this.contactForwardQueueRepository.addContactForwardQueue(contactForwardQueueDTO);
    }

    async findBroadcastSettingStatsId(broadcastId: bigint, broadcastingId: bigint){
        return await this.broadcastSettingStatRepository.findBroadcastSettingStatsId(broadcastId, broadcastingId);
    }

    async addBroadcastSettingStats(broadcastSettingStats: BroadcastSettingStatsCreateDto){
        return await this.broadcastSettingStatRepository.addBroadcastSettingStats(broadcastSettingStats);
    }

    async incrementBroadcastStat(broadcastSettingStatId: bigint, fieldName:string, incrementValue:number):Promise<boolean>{
        return await this.broadcastSettingStatRepository.incrementBroadcastStat(broadcastSettingStatId, fieldName, incrementValue);
    }

    async updateBroadcastAndContact(broadcastId: bigint, contactId: bigint, data: any){
        return await this.broadcastContactRepository.updateByBroadcastAndContact(broadcastId, contactId, data);
    }
    
    async incrementBroadcastTotalContacted(broadcastId: bigint, fieldName:string, incrementValue:number):Promise<boolean>{
        return await this.broadcastRepository.incrementBroadcast(broadcastId, fieldName, incrementValue);
    }

    async hasPendingMessageQueueEntry(broadcastId: bigint, contactId: bigint, settingId: bigint){
        return await this.broadcastMessageQueueRepository.hasPendingMessageQueueEntry(broadcastId, contactId, settingId);
    }

    async removeBroadcastMessageQueueById(id:bigint){
        return await this.broadcastMessageQueueRepository.removeBroadcastMessageQueueById(id);
    }
}