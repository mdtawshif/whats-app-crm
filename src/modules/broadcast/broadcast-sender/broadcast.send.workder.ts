import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { SandboxMessageSender } from "./sandbox.message.sender";
import { BroadcastMessageQueue, BroadcastType, ContactForwardQueueStatus, InOut, MessageType, MessagingProduct, PricingMessageType, QueueStatus, User } from "@prisma/client";
import { BroadcastSendHelperService } from "./broadcast.send.helperService";
import { BroadcastSendValidator } from "./broadcast.send.validator";
import { BroadcastSender } from "./broadcast.sender";
import { BroadcastSendRequest } from "./broadcast.send.request";
import { BroadcastSendLogEntryService } from "./broadcast.sender.log";
import { TwilioWAMessageRequest } from "src/modules/gateway-provider/twilio.wa.msg.request";
import { deductMessageCost } from "@/common/helpers/cost-deduction-per-message";
import { TwilioMessageResponse, WAMessageResponse } from "src/modules/gateway-provider/twilio.message.response";
import { BroadcastMessageQueueDTO } from "../dto/broadcast.message.queue.dto";
import { BroadcastSettingStatsCreateDto, ContactForwardQueueDTO } from "../dto/broadcast.dto";
import { ScheduleTimeCalculationService } from "../broadcast.scheduler.service/scheduletime.calculator.service";
import { DateTime } from "luxon";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { ScanStream } from "ioredis";

/**
 * @Milton463
 */
@Injectable()
export class BroadcastSendMessageQeueueWorker {

    constructor(
        private readonly logger: PinoLogger,
        private readonly SandboxMessageSender: SandboxMessageSender,
        private readonly broadcastSendHelperService: BroadcastSendHelperService,
        private readonly broadcastSendValidator: BroadcastSendValidator,
        private readonly broadcastSender: BroadcastSender,
        private readonly broadcastSendLogEntryService: BroadcastSendLogEntryService,
        private readonly scheduleTimeCalculationService: ScheduleTimeCalculationService,
        private readonly broadcastHelperService: BroadcastHelperService
    ) {
        this.logger.setContext(BroadcastSendMessageQeueueWorker.name);
    }


    /**
     * @process individual queue
     * @param queue 
     */
    async processBroadcastMessageQueue(queue: any) {
        const broadcastSendRequest = {
            success: true,
            broadcastMessageQueue: queue,
        }

        try {
            /**
             * @check validation for broadcasting
             */
            const isValidToSendToBroadcastMessage = await this.broadcastSendValidator.isValidRequest(queue, broadcastSendRequest);
            if (!isValidToSendToBroadcastMessage) {
                await this.changeStatus(queue, broadcastSendRequest);
                await this.broadcastSendLogEntryService.writeInvalidMessageLog(queue, broadcastSendRequest);
                await this.updateBroadcastLastMessageAt(queue);
                await this.addBroadcastSettingStats(queue)
                return;
            }

            const waMessageResponse: WAMessageResponse = await this.broadcastSender.sendBroadcastMessage(broadcastSendRequest);
            this.logger.info("isSucess: ", waMessageResponse.success);

            await this.broadcastSendLogEntryService.writeLog(broadcastSendRequest, waMessageResponse);

            await this.removeQueue(queue);

            /**
             * @schedule queue for next priority broadcast setting
             */
            await this.scheduleNextPriority(broadcastSendRequest);

            /**
             * @deduct credit
            */
            if (waMessageResponse.success) {
                await this.deductCredit(broadcastSendRequest);
            }

        } catch (error) {
            this.logger.error(error);
        }

        await this.changeStatus(queue, broadcastSendRequest);

    }

    private async removeQueue(queue: any) {
        const removeQueue = await this.broadcastSendHelperService.removeBroadcastMessageQueueById(queue.id);
        console.log("removeQueue: ", removeQueue);
    }


    /**
         * @Deduct credit
         * @param broadcastSendRequest 
         * @param twilioWAMessageRequest 
         */
    private async deductCredit(broadcastSendRequest: BroadcastSendRequest) {
        const category = broadcastSendRequest.twilioWAMessageRequest?.messageTemplateCategory;
        const messageType = broadcastSendRequest.twilioWAMessageRequest?.isTemplateMessage
            ? (PricingMessageType[category as keyof typeof PricingMessageType] ?? PricingMessageType.TEXT) : PricingMessageType.TEXT;

        const deductCostParams: {
            userId: bigint;
            messageType: PricingMessageType;
            createdBy: bigint;
            agencyId: bigint;
            broadcastId?: bigint;
            broadcastSettingId?: bigint;
            isSuccess: boolean;
            note?: string;
            transactionFor?: string;
            inOut: InOut;
        } = {
            userId: broadcastSendRequest.user.parentUserId ? broadcastSendRequest.user.parentUserId : broadcastSendRequest.user.id,
            createdBy: broadcastSendRequest.user.id ?? null,
            agencyId: broadcastSendRequest.user.agencyId,
            broadcastId: broadcastSendRequest.broadcast.id,
            broadcastSettingId: broadcastSendRequest.broadcastSetting.id,
            messageType: messageType,
            isSuccess: true,
            note: `Send broadcast ${broadcastSendRequest.twilioWAMessageRequest.isTemplateMessage ? 'Template Message' : 'Text messsage'}`,
            transactionFor: 'Broadcast Message',
            inOut: InOut.OUT
        };
        console.log("deductCostParams: ", deductCostParams);
        await deductMessageCost(deductCostParams);
    }

    private async changeStatus(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest) {
        const data: any = {
            status: broadcastSendRequest.success ? QueueStatus.SENT : QueueStatus.FAILED,
            failedReason: broadcastSendRequest.success ? "" : broadcastSendRequest.errorMessage
        }
        await this.broadcastSendHelperService.changeBroadcastMessageQueueStatus([broadcastMessageQueue.id], data);
    }

    private async scheduleNextPriority(broadcastSendRequest: BroadcastSendRequest) {

        if (broadcastSendRequest.broadcastSetting.broadcast_type === BroadcastType.RECURRING) {
            await this.scheduleRecurringSeqeunce(broadcastSendRequest);
            return;
        }

        if (broadcastSendRequest.broadcastSetting.broadcast_type !== BroadcastType.IMMEDIATE
            && broadcastSendRequest.broadcastSetting.broadcast_type !== BroadcastType.SCHEDULE) {
            return;
        }

        const contactForwardQueue: ContactForwardQueueDTO = {
            userId: broadcastSendRequest.user.id,
            agencyId: broadcastSendRequest.user.agencyId,
            contactId: broadcastSendRequest.contact.id,
            broadcastId: broadcastSendRequest.broadcast.id,
            broadcastSettingId: broadcastSendRequest.broadcastSetting.id,
            status: ContactForwardQueueStatus.PENDING
        }
        const contactForwardQueueId = await this.broadcastSendHelperService.addContactForwardQueue(contactForwardQueue);
        console.log("contactForwardQueue: ", contactForwardQueue != null);
    }


    private async updateBroadcastLastMessageAt(broadcastMessageQueue: BroadcastMessageQueue) {
        const data: any = {
            lastMessageAt: new Date(),
        }
        await this.broadcastSendHelperService.updateBroadcastAndContact(broadcastMessageQueue.broadcastId, broadcastMessageQueue.contactId, data);
    }


    private async addBroadcastSettingStats(queue: BroadcastMessageQueue) {

        const broadcastSettingStatId = await this.broadcastSendHelperService.findBroadcastSettingStatsId(queue.broadcastId, queue.broadcastSettingId);
        if (broadcastSettingStatId) {
            const fieldName = 'total_failed';
            const statIncremented = await this.broadcastSendHelperService.incrementBroadcastStat(broadcastSettingStatId, fieldName, 1);
            console.log("statIncremented: ", statIncremented);
            return;
        }

        // const failed: number = 1;

        // const broadcastSettingStats: BroadcastSettingStatsCreateDto = {
        //     userId: queue.userId,
        //     agencyId: queue.agencyId,
        //     broadcastId: queue.broadcastId,
        //     broadcastSettingId: queue.broadcastSettingId,
        //     totalSent: 0,
        //     totalFailed: failed
        // }

        // const broadcastSettingStat = await this.broadcastSendHelperService.addBroadcastSettingStats(broadcastSettingStats);
        // console.log("broadcastSettingStatId", broadcastSettingStat!=null);

    }


    /**
     * @Schedule recurring Settings
     * @param broadcastSendRequest 
     * @returns 
     */
    private async scheduleRecurringSeqeunce(broadcastSendRequest: BroadcastSendRequest) {

        const hasMessageQueueEntry = await this.broadcastSendHelperService.hasPendingMessageQueueEntry(
            broadcastSendRequest.broadcast.id,
            broadcastSendRequest.contact.id,
            broadcastSendRequest.broadcastSetting.id
        )

        if (hasMessageQueueEntry) {
            console.log(`already queue exists for this contact: ${broadcastSendRequest.contact.id} & setting: ${broadcastSendRequest.broadcastSetting.id}`)
            return;
        }

        const broadcastSettingDTO = {
            id: broadcastSendRequest.broadcastSetting.id,
            broadcastType: broadcastSendRequest.broadcastSetting.broadcast_type,
            day: broadcastSendRequest.broadcastSetting.day,
            priority: broadcastSendRequest.broadcastSetting.priority,
            time: DateTime.fromJSDate(broadcastSendRequest.broadcastSetting.time).toFormat("HH:mm"),
            waBusinessNumberId: broadcastSendRequest.broadcastSetting.waBusinessNumberId,
            messageTemplateId: broadcastSendRequest.broadcastSetting.messageTemplateId
        }

        let broadcastProcessRequest = {
            success: true,
            broadcastSettingDTO: broadcastSettingDTO,
            broadcast: broadcastSendRequest.broadcast,
            broadcastContact: null,
            broadcastId: broadcastSendRequest.broadcast.id,
            user: broadcastSendRequest.user
        }

        let newScheduleDate = DateTime.fromJSDate(broadcastSendRequest.broadcastMessageQueue.sentAt).plus({ days: broadcastProcessRequest.broadcastSettingDTO.day });
        console.log("newScheduleDate:", newScheduleDate);
        const scheduleDate = await this.scheduleTimeCalculationService.calculateRecurringScheduleTime(broadcastProcessRequest, newScheduleDate);
        if (!scheduleDate) {
            return;
        }
        console.log("next: recurring.scheduleDate: ", scheduleDate);

        const broadcastMessageQueue = await this.buildBroadcastQueue(broadcastSendRequest, scheduleDate);
        const broadcastMessageQueues: BroadcastMessageQueueDTO[] = [broadcastMessageQueue];

        if (!broadcastMessageQueues || broadcastMessageQueues.length === 0) {
            return;
        }
        const totalMessageQueues = await this.broadcastHelperService.addBroadcstMessageQueues(broadcastMessageQueues);
        console.log("recurring:: totalMessageQueues: ", totalMessageQueues);
    }

    async buildBroadcastQueue(broadcastSendRequest: BroadcastSendRequest, scheduleDate: any) {
        const broadcastMessageQueueDTO = {
            agencyId: broadcastSendRequest.user.agencyId,
            userId: broadcastSendRequest.user.id,
            contactId: broadcastSendRequest.contact.id,
            broadcastId: broadcastSendRequest.broadcast.id,
            broadcastSettingId: broadcastSendRequest.broadcastSetting.id,
            waBusinessNumberId: broadcastSendRequest.broadcastMessageQueue.waBusinessNumberId,
            status: QueueStatus.PENDING,
            sentAt: scheduleDate,
            failedReason: null,
            response: null,
            messageType: broadcastSendRequest.broadcastSetting.messageTemplateId ? MessageType.TEMPLATE : MessageType.TEXT,
            messagingProduct: MessagingProduct.WHATS_APP
        }
        return broadcastMessageQueueDTO;
    }
}