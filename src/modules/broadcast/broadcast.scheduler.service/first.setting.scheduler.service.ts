import { PinoLogger } from "nestjs-pino";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { ScheduleTimeCalculationService } from "./scheduletime.calculator.service";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { BroadcastSettingDTO } from "../dto/broadcast.setting.dto";
import { looker } from "googleapis/build/src/apis/looker";
import { DateTime, Duration } from "luxon";
import { BroadcastType } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { BroadcastMessageQueueDTO } from "../dto/broadcast.message.queue.dto";

/**
 * @author @Milton
 */
@Injectable()
export class FirstSettingSchdeulerService {
    
    constructor(
        private readonly broadcastHelperService: BroadcastHelperService,
        private readonly logger: PinoLogger,
        private readonly scheduleTimeCalculationService: ScheduleTimeCalculationService
    ){
        this.logger.setContext(FirstSettingSchdeulerService.name);
    }

    /**
     * @Process immediate and schedule settings
     */
    async processFirstSetting(broadcastProcessRequest: BroadcastProcessRequest, priority:number){
        // this.logger.info("priority: ", priority);
        console.log("priority:", priority);
        const broadcastSetting : BroadcastSettingDTO [] = await this.broadcastHelperService.findFirstBroadcastSetting(broadcastProcessRequest.broadcast.id, priority);
        if (!broadcastSetting || broadcastSetting.length === 0) {
            this.logger.error(`No remaining first settings found for this broadcast: ${broadcastProcessRequest.broadcast.id}`);
            return;
        }
        // this.logger.info("schedulebroadcastSetting:", broadcastSetting);

        const firstPriority = broadcastSetting[0].priority;
        const filteredSettings = broadcastSetting.filter((setting) => setting.priority === firstPriority);

        const broadcastMessageQueues: BroadcastMessageQueueDTO[] = [];
        for(const firstSetting of filteredSettings){
            broadcastProcessRequest.broadcastSettingDTO = firstSetting;
            if (!broadcastProcessRequest.broadcastContact?.entryDate) {
                continue;
            }
            await this.scheduleSetting(broadcastProcessRequest, broadcastMessageQueues);
        } 

        this.logger.info("first:broadcastMessageQueues: ", broadcastMessageQueues.length);
        const totalMessageQueues = await this.broadcastHelperService.addBroadcstMessageQueues(broadcastMessageQueues);
        console.log("totalMessageQueues: ", totalMessageQueues);
    }

    /**
     * @Calculate schedule time and schedule queue
     */
    private async scheduleSetting(broadcastProcessRequest: BroadcastProcessRequest, broadcastMessageQueues: BroadcastMessageQueueDTO[]){
        let scheduleDate: DateTime = broadcastProcessRequest.broadcastContact.entryDate ? DateTime.fromJSDate(broadcastProcessRequest.broadcastContact.entryDate): DateTime.now();

        if (broadcastProcessRequest.broadcastSettingDTO.broadcastType === BroadcastType.SCHEDULE) {
            scheduleDate = broadcastProcessRequest.broadcastContact.lastMessageAt ? DateTime.fromJSDate(broadcastProcessRequest.broadcastContact.lastMessageAt)
                : DateTime.now();
            }
            scheduleDate = await this.scheduleTimeCalculationService.calculateScheduleDateForSchduleSetting(broadcastProcessRequest, scheduleDate);
            console.log("scheduleDate.........", scheduleDate);
            const broadcastMessageQueue = await this.broadcastHelperService.buildBroadcastQueue(broadcastProcessRequest, scheduleDate);
            if(broadcastMessageQueue != null){
                broadcastMessageQueues.push(broadcastMessageQueue);
            }
        }
}    