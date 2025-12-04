import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { BroadcastSendRequest } from "./broadcast.send.request";
import { BroadcastLogStatus, BroadcastMessageLog, BroadcastMessageQueue, ConversationInOut, ConversationMessageType, ConversationReadStatus, ConversationStatus, InboxInOut, InboxStatus, InOut, MessagingProduct } from "@prisma/client";
import type { BroadcastMessageLogDTO } from "../dto/broadcast.messagelog.dto";
import { TwilioMessageResponse, WAMessageResponse } from "src/modules/gateway-provider/twilio.message.response";
import { DateTime } from "luxon";
import { BroadcastSendHelperService } from "./broadcast.send.helperService";
import { MessageLogService } from "../message-log.service";
import { AwsInstance } from "twilio/lib/rest/accounts/v1/credential/aws";
import { CreateBroadcastLogDto, CreateConversationLogDto, CreateInboxThreadLogDto } from "../dto/message-logs.dto";
import { BroadcastSettingStatsDTO } from "../dto/broadcast.sequence.stats.dto";
import { BroadcastSettingStatsCreateDto } from "../dto/broadcast.dto";
import { NumbersV1PortingPortInCreatePhoneNumbers } from "twilio/lib/rest/numbers/v1/portingPortIn";

/**
 * @Milton463
 */
@Injectable()
export class BroadcastSendLogEntryService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly broadcastSendHelperService: BroadcastSendHelperService,
        private readonly messageLogService: MessageLogService

    ) {
        this.logger.setContext(BroadcastSendLogEntryService.name);
    }


    async writeLog(broadcastSendRequest: BroadcastSendRequest, waMessageResponse: WAMessageResponse) {

        await this.createMessageQueueLog(broadcastSendRequest, waMessageResponse);

        await this.addConversations(broadcastSendRequest, waMessageResponse);

        await this.addInboxThread(broadcastSendRequest, waMessageResponse);

        await this.addBroadcastSettingStats(broadcastSendRequest, waMessageResponse);

        await this.updateBroadcastLastMessageAt(broadcastSendRequest);

        if(waMessageResponse.success){
            await this.incrementTotalContacted(broadcastSendRequest.broadcast.id);
        }
    }

    /**
     * @AddBroadcastMesssageLog
     * @param broadcastSendRequest 
     * @param twilioMessageResponse 
     */
    public async createMessageQueueLog(broadcastSendRequest: BroadcastSendRequest, waMessageResponse: WAMessageResponse) {

        const broadcastMessageLogDto: BroadcastMessageLogDTO = {
            agencyId: broadcastSendRequest.user.agencyId,
            userId: broadcastSendRequest.user.id,
            contactId: broadcastSendRequest?.contact?.id,
            broadcastId: broadcastSendRequest?.broadcast?.id,
            broadcastSettingId: broadcastSendRequest?.broadcastSetting?.id,
            waBusinessAccountId: broadcastSendRequest?.waBusinessAccount?.id,
            fbBusinessId: broadcastSendRequest?.fbBusinessAccount?.id,
            waBusinessNumberId: broadcastSendRequest?.broadcastMessageQueue?.waBusinessNumberId,
            messagingProduct: MessagingProduct.WHATS_APP,
            message: broadcastSendRequest?.twilioWAMessageRequest.isTemplateMessage ? "" : broadcastSendRequest?.twilioWAMessageRequest.messageBody,
            messageType: broadcastSendRequest?.twilioWAMessageRequest.isTemplateMessage ? ConversationMessageType.TEMPLATE : ConversationMessageType.TEXT,
            response: JSON.stringify(waMessageResponse),
            errorMessage: waMessageResponse?.success ? "" : waMessageResponse?.errorMessage,
            status: waMessageResponse?.success ? BroadcastLogStatus.SENT : BroadcastLogStatus.FAILED,
            lastMessageAt: new Date(),
            messageSid: waMessageResponse?.twilioMessageResponse?.sid || "",
            accountSid: broadcastSendRequest.twilioWAMessageRequest?.gatewayAuth?.authKey || ""
        }
        const broadcastMessageLog = await this.broadcastSendHelperService.addBroadcastMessageLog(broadcastMessageLogDto);
        console.log("broadcastMessageLogId: " + broadcastMessageLog.id);
    }


    /**
     * @add conversations
     * @param broadcastSendRequest 
     * @param waMessageResponse 
     */
    async addConversations(broadcastSendRequest: BroadcastSendRequest, waMessageResponse: WAMessageResponse) {
        console.log("waBusinessNumber, ", broadcastSendRequest.waBusinessNumber);
        const createConversationLogDto: CreateConversationLogDto = {
            agencyId: broadcastSendRequest.user.agencyId,
            userId: broadcastSendRequest.user.id,
            contactId: broadcastSendRequest.contact.id,
            broadcastId: broadcastSendRequest.broadcast.id,
            fromNumber: broadcastSendRequest.waBusinessNumber.number,
            toNumber: broadcastSendRequest.contact.number,
            inOut: ConversationInOut.OUT,
            message: broadcastSendRequest.twilioWAMessageRequest.isTemplateMessage ? "" : broadcastSendRequest.twilioWAMessageRequest.messageBody,
            messageType: broadcastSendRequest.twilioWAMessageRequest.isTemplateMessage ? ConversationMessageType.TEMPLATE : ConversationMessageType.TEXT,
            messagingProduct: MessagingProduct.WHATS_APP,
            messageId: broadcastSendRequest.messageTemplate ? broadcastSendRequest.messageTemplate.messageId : "",
            response: JSON.stringify(waMessageResponse),
            status: waMessageResponse.success ? BroadcastLogStatus.SENT : BroadcastLogStatus.FAILED,
            lastMessageAt: new Date(),
            messageSid: waMessageResponse?.twilioMessageResponse?.sid || "",
            accountSid: broadcastSendRequest.twilioWAMessageRequest?.gatewayAuth?.authKey || "",
            isRead: ConversationReadStatus.UNREAD,
            phoneNumberId: broadcastSendRequest.waBusinessNumber.phoneNumberId,
            wabaId: broadcastSendRequest.waBusinessAccount.wabaId,
            wabaName: broadcastSendRequest.waBusinessAccount.name,
            businessId: broadcastSendRequest.fbBusinessAccount.businessId,
            businessName: broadcastSendRequest.fbBusinessAccount.name
        }

        const conversation = await this.messageLogService.conversationLogs(createConversationLogDto);
        console.log("conversationId: " + conversation.id);

    }

    /**
     * @Add inboxThread
     * @param broadcastSendRequest 
     * @param waMessageResponse 
     */
    private async addInboxThread(broadcastSendRequest: BroadcastSendRequest, waMessageResponse: WAMessageResponse) {

        let message = broadcastSendRequest.twilioWAMessageRequest.messageBody;
        if(broadcastSendRequest.messageTemplate && broadcastSendRequest.twilioWAMessageRequest.isTemplateMessage){
          message = broadcastSendRequest.messageTemplate.name;
        }

        const createInboxThreadLogDto: CreateInboxThreadLogDto = {
            agencyId: broadcastSendRequest.user.agencyId,
            userId: broadcastSendRequest.user.id,
            contactId: broadcastSendRequest.contact.id,
            contentType: broadcastSendRequest.twilioWAMessageRequest.isTemplateMessage ? "TEMPLATE" : "TEXT",
            isRead: ConversationReadStatus.UNREAD,
            inOut: InboxInOut.OUT,
            from: broadcastSendRequest.waBusinessNumber.number,
            to: broadcastSendRequest.contact.number,
            status: waMessageResponse.success ? InboxStatus.SUCCESS : InboxStatus.FAILED,
            lastCommunication: new Date(),
            messageContent: message
        }

        const inboxThread = await this.messageLogService.createInboxThread(createInboxThreadLogDto);
        console.log("inboxThreadId: " + inboxThread.id);
    }

    /**
     * @invalid message log
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     */
    async writeInvalidMessageLog(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest) {

        const broadcastMessageLogDto: BroadcastMessageLogDTO = {
            agencyId: broadcastMessageQueue.agencyId,
            userId: broadcastMessageQueue.userId,
            contactId: broadcastMessageQueue.contactId,
            broadcastId: broadcastMessageQueue.broadcastId,
            broadcastSettingId: broadcastMessageQueue.broadcastSettingId,
            waBusinessNumberId: broadcastMessageQueue.waBusinessNumberId,
            messagingProduct: MessagingProduct.WHATS_APP,
            messageType: broadcastMessageQueue.messageType,
            errorMessage: broadcastSendRequest.errorMessage,
            status: BroadcastLogStatus.FAILED,
        }
        const broadcastMessageLog = await this.broadcastSendHelperService.addBroadcastMessageLog(broadcastMessageLogDto);
        console.log("broadcastMessageLogId: " + broadcastMessageLog.id);
    }


    /**
     * @Increment BroadcastSettingStatitics based on sucess failed.
     * @param broadcastSendRequest 
    * @param waMessageResponse 
     * @returns 
     */
    private async addBroadcastSettingStats(broadcastSendRequest: BroadcastSendRequest, waMessageResponse: WAMessageResponse){

        const broadcastSettingStatId = await this.broadcastSendHelperService.findBroadcastSettingStatsId(broadcastSendRequest.broadcast.id, broadcastSendRequest.broadcastSetting.id);
        if(broadcastSettingStatId){
           const fieldName = waMessageResponse.success ? 'total_sent' : 'total_failed';
           const  statIncremented = await this.broadcastSendHelperService.incrementBroadcastStat(broadcastSettingStatId, fieldName, 1);
           console.log("statIncremented: ", statIncremented);
           return;
        }

        // const sent: number = waMessageResponse.success ? 1: 0;
        // const failed: number = waMessageResponse.success ? 0 : 1;

        // const broadcastSettingStats: BroadcastSettingStatsCreateDto = {
        //     userId: broadcastSendRequest.user.id,
        //     agencyId: broadcastSendRequest.user.agencyId,
        //     broadcastId: broadcastSendRequest.broadcast.id,
        //     broadcastSettingId: broadcastSendRequest.broadcastSetting.id,
        //     totalSent: sent,
        //     totalFailed: failed
        // }
        
        // const broadcastSettingStat = await this.broadcastSendHelperService.addBroadcastSettingStats(broadcastSettingStats);
        // console.log("broadcastSettingStatId", broadcastSettingStat!=null);

    }

    private async updateBroadcastLastMessageAt(broadcastSendRequest :BroadcastSendRequest){
        const data: any = {
          lastMessageAt: new Date(),
        }
        await this.broadcastSendHelperService.updateBroadcastAndContact(broadcastSendRequest.broadcast.id, broadcastSendRequest.contact.id, data);
    }

    private async incrementTotalContacted(broadcastId: bigint){
        const fieldName = 'total_contacted';
        const  statIncremented = await this.broadcastSendHelperService.incrementBroadcastTotalContacted(broadcastId, fieldName, 1);
        console.log("broadcastTotalContacted: ", statIncremented);
    }

}
