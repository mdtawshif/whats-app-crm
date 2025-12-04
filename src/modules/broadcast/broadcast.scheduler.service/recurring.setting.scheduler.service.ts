import { Injectable } from "@nestjs/common";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { PinoLogger } from "nestjs-pino";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { ScheduleTimeCalculationService } from "./scheduletime.calculator.service";
import { BroadcastSettingDTO } from "../dto/broadcast.setting.dto";
import { DateTime } from "luxon";
import { BroadcastMessageQueueDTO } from "../dto/broadcast.message.queue.dto";

/**
 * @author @Milton
 */
@Injectable()
export class RecurringSettingSchedulerService {

    constructor(
        private readonly broadcastHelperService: BroadcastHelperService,
        private readonly logger: PinoLogger,
        private readonly scheduleTimeCalculationService: ScheduleTimeCalculationService
    ){}


    /**
     * @method to schdule recurring settings
     * @param broadcastProcessRequest 
     * @returns 
     */
    async processRecurringSettings(broadcastProcessRequest: BroadcastProcessRequest){
        const recurringSettings = await this.broadcastHelperService.findBroadcastRecurringSettings(broadcastProcessRequest.broadcast.id);
        if(!recurringSettings || recurringSettings.length === 0){
            this.logger.error(`No recurring settings for this broadcast: ${broadcastProcessRequest.broadcastId}`);
            return;
        }
        this.logger.info("recurringSettings: ", recurringSettings.length);
        console.log("recurringSettings: ", recurringSettings.length);

        if(broadcastProcessRequest.broadcastContact == null || broadcastProcessRequest.broadcastContact.entryDate == null){
            return;
        }

        const broadcastMessageQueues: BroadcastMessageQueueDTO[] = [];
        for (const broadcastSetting of recurringSettings) {
            broadcastProcessRequest.broadcastSettingDTO = broadcastSetting;

            const lastRecurringSentTime = await this.broadcastHelperService.findLastSentRecurringSetting(broadcastProcessRequest.broadcast.id, broadcastProcessRequest.broadcastContact.contactId, broadcastProcessRequest.broadcastSettingDTO.id);
            console.log("lastRecurringSentTime:", lastRecurringSentTime);
            const lastSentTime = lastRecurringSentTime && lastRecurringSentTime.lastMessageAt ? DateTime.fromJSDate(lastRecurringSentTime.lastMessageAt).plus({ days: broadcastProcessRequest.broadcastSettingDTO.day}) : DateTime.fromJSDate(broadcastProcessRequest.broadcastContact.entryDate);
            console.log("lastSentTime:", lastSentTime);

            const scheduleDate = await this.scheduleTimeCalculationService.calculateRecurringScheduleTime(broadcastProcessRequest, lastSentTime);
            const broadcastMessageQueueDTO = await this.broadcastHelperService.buildBroadcastQueue(broadcastProcessRequest, scheduleDate);
            broadcastMessageQueues.push(broadcastMessageQueueDTO);
        }
        this.logger.info("recurring: broadcastMessageQueues: ", broadcastMessageQueues.length);
        if(!broadcastMessageQueues || broadcastMessageQueues.length ===0){
            return;
        }
        const totalMessageQueues = await this.broadcastHelperService.addBroadcstMessageQueues(broadcastMessageQueues);
        console.log("recurring:: totalMessageQueues: ", totalMessageQueues);
    }

}