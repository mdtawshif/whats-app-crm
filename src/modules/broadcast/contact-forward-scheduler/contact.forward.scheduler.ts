import { Injectable } from "@nestjs/common";
import { Broadcast, BroadcastSetting, ContactForwardQueue } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { ContactForwardSchedulerHelperService } from "./forward.scheduler.helper.service";
import { BroadcastSettingDTO } from "../dto/broadcast.setting.dto";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { DateTime } from "luxon";
import { ScheduleTimeCalculationService } from "../broadcast.scheduler.service/scheduletime.calculator.service";
import { BroadcastMessageQueueDTO } from "../dto/broadcast.message.queue.dto";


/**
 * @author @Milton
 */
@Injectable()
export class ContactForwardScheduler {
    
    constructor(
      private readonly logger: PinoLogger,
      private readonly contactForwardSchedulerHelperService: ContactForwardSchedulerHelperService,
      private readonly broadcastHelperService: BroadcastHelperService,
      private readonly scheduleTimeCalculationService: ScheduleTimeCalculationService,
    ){
        this.logger.setContext(ContactForwardScheduler.name);
    }

    /**
     * @method to schedule next priority forward setting
     * @param contactForwardQueue 
     * @param broadcastProcessRequest 
     */
    async scheduleNextPriorityForwardQueue(contactForwardQueue: ContactForwardQueue, broadcastProcessRequest: BroadcastProcessRequest){
        
        /**
         * @find complete setting
         */
        const completeBroadcastSetting = await this.contactForwardSchedulerHelperService.findCompleteBroadcastSetting(contactForwardQueue.broadcastSettingId);
        if(completeBroadcastSetting == null){
            broadcastProcessRequest.success = false;
            broadcastProcessRequest.errorMessage = `No complete setting found for this broadcast setting id: ${contactForwardQueue.broadcastSettingId}`;
            return;
        }
        
        /**
         * @load forward settings with higher priority
         */
        const forwardSettings:BroadcastSettingDTO [] = await this.loadBroadcastForwardSettings(contactForwardQueue, broadcastProcessRequest, completeBroadcastSetting);
        if(!broadcastProcessRequest.success){
            return;
        }

        const broadcastMessageQueues: BroadcastMessageQueueDTO[] = [];
        for(const forwardSetting of forwardSettings){
            const scheduleDate = await this.calculateScheduleQueueDate(contactForwardQueue, forwardSetting, broadcastProcessRequest, completeBroadcastSetting);   
            console.log("fr:scheduleDate: ", scheduleDate);
            if(scheduleDate == null){
                continue;
            }
           const broadcastMessageQueue = await this.broadcastHelperService.buildBroadcastQueue(broadcastProcessRequest, scheduleDate);
           broadcastMessageQueues.push(broadcastMessageQueue);
        }

        if(broadcastMessageQueues.length===0){
          return;
        }

        const totalMessageQueues = await this.broadcastHelperService.addBroadcstMessageQueues(broadcastMessageQueues);
        console.log("totalMessageQueues: ", totalMessageQueues);
    }

    /**
     * 
     * @param contactForwardQueue 
     * @param forwardSetting 
     * @param broadcastProcessRequest 
     * @param completeBroadcastSetting 
     * @returns 
     */
    private async calculateScheduleQueueDate(contactForwardQueue: ContactForwardQueue, forwardSetting: BroadcastSettingDTO, 
        broadcastProcessRequest: BroadcastProcessRequest, completeBroadcastSetting: BroadcastSetting){

        broadcastProcessRequest.broadcastSettingDTO = forwardSetting;

        /**
         * @check if setting already sent to this contact
         */
        const isAlreadySent = await this.broadcastHelperService.hasBroasstMessageLog(broadcastProcessRequest.broadcast.id, broadcastProcessRequest.broadcastContact.contactId, forwardSetting.id);
        if(isAlreadySent){
            this.logger.error(`Broadcast message log already exists for broadcastId: ${broadcastProcessRequest.broadcast.id}, contactId: ${broadcastProcessRequest.broadcastContact.contactId}, broadcastSettingId: ${forwardSetting.id}. Skipping scheduling.`);
            return;
        }

        /**
         * @schedule next forward setting
         */
        return await this.calculateScheduleDate(contactForwardQueue, broadcastProcessRequest, completeBroadcastSetting);
    }

    /**
     * @Calculate schedule date for forward setting
     * @param contactForwardQueue 
     * @param broadcastProcessRequest 
     * @param completeBroadcastSetting 
     * @returns 
     */
    private async calculateScheduleDate(contactForwardQueue: ContactForwardQueue, broadcastProcessRequest: BroadcastProcessRequest, completeBroadcastSetting: BroadcastSetting){
        const lsetMessageSentAt = DateTime.fromJSDate(contactForwardQueue.createdAt);
        console.log("lsetMessageSentAt.........", lsetMessageSentAt);

        const newScheduleDate = await this.scheduleTimeCalculationService.calculateForwardSettingScheduleDate(broadcastProcessRequest, completeBroadcastSetting, lsetMessageSentAt);
        console.log("newScheduleDate.........", newScheduleDate);

        return newScheduleDate;
    }


    /**
     * @load setting for scheduling queue
     * @param contactForwardQueue 
     * @param broadcastProcessRequest 
     * @returns 
     */
    private async loadBroadcastForwardSettings(contactForwardQueue: ContactForwardQueue, broadcastProcessRequest: BroadcastProcessRequest, completeBroadcastSetting: BroadcastSetting) {
        broadcastProcessRequest.success = false;
        
        const  priority: number = completeBroadcastSetting ? completeBroadcastSetting.priority ?? -1 : -1;
        const forwardBroadcastSetting: BroadcastSettingDTO[] = await this.contactForwardSchedulerHelperService.findHigherPriorityForwardSetting(contactForwardQueue.broadcastId, priority);

         if (!forwardBroadcastSetting || forwardBroadcastSetting.length === 0) {
             broadcastProcessRequest.errorMessage = `No higher priority forward setting found for this broadcast id: ${contactForwardQueue.broadcastId} and priority: ${priority}`;
            return;
        }

        const firstPriority = forwardBroadcastSetting[0].priority;
        const forwardSettings = forwardBroadcastSetting.filter((setting) => setting.priority === firstPriority);
        if (!forwardSettings || forwardSettings.length === 0) {
            broadcastProcessRequest.errorMessage = `No filtered higher priority forward setting found for this broadcast id: ${contactForwardQueue.broadcastId} and priority: ${priority}`;
            return;
        }
        
        broadcastProcessRequest.success = true;
        return forwardSettings;
    }
}