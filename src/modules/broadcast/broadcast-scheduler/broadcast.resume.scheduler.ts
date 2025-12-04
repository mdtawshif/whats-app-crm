import { Injectable } from "@nestjs/common";
import { BroadcastSchedulerService } from "./broadcast.scheduler.service";
import { PinoLogger } from "nestjs-pino";
import { Broadcast, BroadcastContact, BroadcastContactStatus, BroadcastPauseResumeRequest, BroadcastStatus, Prisma, UserStatus } from "@prisma/client";
import { BroadcastSchedulerProcessResponse } from "./broadcast.scheduler.process.response";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { RecurringSettingSchedulerService } from "../broadcast.scheduler.service/recurring.setting.scheduler.service";
import { FirstSettingSchdeulerService } from "../broadcast.scheduler.service/first.setting.scheduler.service";
import { DateTime } from "luxon";

/**
 * @author @Milton
 */
@Injectable()
export class BroadcastResumeScheduler{

    constructor(
        private readonly broadcastSchedulerService: BroadcastSchedulerService,
        private readonly logger: PinoLogger,
        private readonly broadcastHelperService: BroadcastHelperService,
        private readonly recurringSettingSchedulerService: RecurringSettingSchedulerService,
        private readonly firstSettingSchdeulerService: FirstSettingSchdeulerService
    ){
        this.logger.setContext(BroadcastResumeScheduler.name);
    }


    /**
     * @Method to process and schedule queue for broadcast resume request
     * @param broadcastPauseResumeRequest 
     * @param broadcastProcessRequest 
     * @returns 
     */
    async processResumeRequest(broadcastPauseResumeRequest: BroadcastPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){
        const resumedBroadcast = await this.resumeBroadcastStatus(broadcastPauseResumeRequest);
        console.log("resumedBroadcast: ", resumedBroadcast);
        if(!resumedBroadcast){
            broadcastProcessRequest.success = false,
            broadcastProcessRequest.errorMessage = `Failed to resume broadcast: ${broadcastPauseResumeRequest.id}`;
            return broadcastProcessRequest;
        }

        /**
         * @schedule broadcast after starting broadcast
         */
        await this.sheduleBroadcasts(broadcastPauseResumeRequest, broadcastProcessRequest);
        return broadcastProcessRequest;
    }

    /**
     * @Schedule broadcasts
     * @param broadcastPauseResumeRequest 
     */
    async sheduleBroadcasts(broadcastPauseResumeRequest: BroadcastPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){
        const canSchedule = await this.canSchedule(broadcastPauseResumeRequest, broadcastProcessRequest);
        if(!canSchedule){
            return;
        }

        let CONTACT_BATCH_SIZE = 100;
        let contactId: bigint = 0n;
        let hasNextContacts = true;

        do{
            const broadcastContacts = await this.broadcastSchedulerService.findActiveBroadcastContacts(broadcastPauseResumeRequest.broadcastId, contactId, CONTACT_BATCH_SIZE);
            if(!broadcastContacts || broadcastContacts.length === 0){
                hasNextContacts = false;
                break;
            }
            contactId = broadcastContacts[broadcastContacts.length - 1].contactId;
            
            await this.schedule(broadcastContacts, broadcastProcessRequest);

        }while(hasNextContacts)

    }


    /**
     * @iterate & schedule broadcast settings
     * @param broadcastContacts 
     * @param broadcastProcessRequest 
     */
    private async schedule(broadcastContacts: BroadcastContact[], broadcastProcessRequest: BroadcastProcessRequest){
        
        for(const broadcastContact of broadcastContacts){
            broadcastContact.entryDate = new Date();
            broadcastProcessRequest.broadcastContact = broadcastContact;

            await this.processRecurringBroadcastSettings(broadcastProcessRequest);

            await this.processFirstBroadcastSettings(broadcastProcessRequest);
        }
    }

    /**
     * @schedule queue for recurring settings
     * @param broadcastProcessRequest 
     */
    private async processRecurringBroadcastSettings(broadcastProcessRequest: BroadcastProcessRequest){
        await this.recurringSettingSchedulerService.processRecurringSettings(broadcastProcessRequest);
    }

    /**
     * @schedule queue for immediate or schedule settings
     * @param broadcastProcessRequest 
     */
    private async processFirstBroadcastSettings(broadcastProcessRequest: BroadcastProcessRequest){
        const broadcastContact = broadcastProcessRequest.broadcastContact;
        const broadcastSettingDTO = await this.broadcastHelperService.findBroadcastContactLastSettingId(broadcastContact.broadcastId, broadcastContact.contactId);
        const priority: number = broadcastSettingDTO ? broadcastSettingDTO.priority ?? -1 : -1;
        
        await this.firstSettingSchdeulerService.processFirstSetting(broadcastProcessRequest, priority);
     }


    /**
     * @check able to schedule queue
     * @param broadcastPauseResumeRequest 
     * @param broadcastProcessRequest 
     * @returns 
     */
    private async canSchedule(broadcastPauseResumeRequest: BroadcastPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest): Promise<boolean>{
        const canSchedule: boolean = false;
        const user = await this.broadcastHelperService.findUserById(broadcastPauseResumeRequest.userId);
        if(!user || user.status!=UserStatus.ACTIVE){
            broadcastProcessRequest.success = false,
            broadcastProcessRequest.errorMessage ='User either does not exist or is not active'
            return canSchedule;
        }
        broadcastProcessRequest.user = user;

        const broadcast = await this.broadcastHelperService.findBroadcastById(broadcastPauseResumeRequest.broadcastId);
        if(!broadcast || broadcast.status !=BroadcastContactStatus.RUNNING){
            broadcastProcessRequest.success = false,
            broadcastProcessRequest.errorMessage =`Broadcast either does not exist or is not running`
            return canSchedule;
        }
        if(broadcast.timeZone == null){
            broadcast.timeZone = user.timeZone;
        }
        broadcastProcessRequest.broadcast = broadcast;
        
        return true;
    }

    /**
     * @Marked broadcast as running
     * @param broadcastPauseResumeRequest 
     * @return 
     */
    private async resumeBroadcastStatus(broadcastPauseResumeRequest: BroadcastPauseResumeRequest){
        const data:any = {
            status: BroadcastStatus.RUNNING,
            startedAt:new Date()
        }
        return await this.broadcastSchedulerService.changeBroadcastStatus(broadcastPauseResumeRequest.broadcastId, data);
    }
    

}