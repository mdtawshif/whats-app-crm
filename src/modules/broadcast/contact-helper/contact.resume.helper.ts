import { Injectable } from "@nestjs/common";
import { ContactHelperService } from "./contact.helper.service";
import { BroadcastContactStatus, ContactPauseResumeRequest, UserStatus } from "@prisma/client";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { ScheduleTimeCalculationService } from "../broadcast.scheduler.service/scheduletime.calculator.service";
import { RecurringSettingSchedulerService } from "../broadcast.scheduler.service/recurring.setting.scheduler.service";
import { FirstSettingSchdeulerService } from "../broadcast.scheduler.service/first.setting.scheduler.service";
import { DateTime } from "luxon";
import { PinoLogger } from "nestjs-pino";
import { books } from "googleapis/build/src/apis/books";
import { BroadcastService } from "../broadcast.service";


/**
 * @author @Milton
 */
@Injectable()
export class ContactResumeHelper {

    constructor(
            private readonly contactHelperService: ContactHelperService,
            private readonly broadcastHelperService: BroadcastHelperService,
            private readonly recurringSettingSchedulerService: RecurringSettingSchedulerService, 
            private readonly firstSettingSchdeulerService: FirstSettingSchdeulerService,
            private readonly broadcastService: BroadcastService,
            private readonly logger: PinoLogger
        ){
            this.logger.setContext(ContactResumeHelper.name);
        }
    
        async processContactResumeRequest(request: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){
    
            const resumeBroadcastContact =  await this.resumeBroadcastContact(request);
            console.log("resumeBroadcastContact: ", resumeBroadcastContact);
            if(!resumeBroadcastContact){
              broadcastProcessRequest.success = false,
              broadcastProcessRequest.errorMessage = `Failed to Resume Contact:${request.contactId} of Broadcast:${request.broadcastId}`
              return broadcastProcessRequest;
            }

              await this.broadcastService.updateBroadcastSummaryUnpause(request.broadcastId);

            //schdule if any 
            await this.scheduleContactQueue(request, broadcastProcessRequest);

            return broadcastProcessRequest;
        }


        private async scheduleContactQueue(request: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){
            const canSchedule = await this.canSchedule(request, broadcastProcessRequest);
            if(!canSchedule){
                return;
            }

            /** schedule recurring setting if any */
            await this.processRecurringSetting(broadcastProcessRequest);

            /**
             *  @schedule immediate and schdule setting based on priority
             */
            const broadcastSettingDTO = await this.broadcastHelperService.findBroadcastContactLastSettingId(request.broadcastId, request.contactId);
            // this.logger.info("broadcastSettingDto: ", broadcastSettingDTO);
            console.log("broadcastSettingDto: ", broadcastSettingDTO);
            const priority: number = broadcastSettingDTO ? broadcastSettingDTO.priority ?? -1 : -1;
            
            await this.firstSettingSchdeulerService.processFirstSetting(broadcastProcessRequest, priority);
        }

        /**
         * @Schedule recurring settings
         * @param broadcastProcessRequest 
         */
        private async processRecurringSetting(broadcastProcessRequest: BroadcastProcessRequest){
            await this.recurringSettingSchedulerService.processRecurringSettings(broadcastProcessRequest);
        }


        /**
         * @check availability of schedule queues
         * @param request 
         * @param response 
         * @returns 
         */
        private async canSchedule(request: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest):Promise<boolean>{
            let canSchedule: boolean = false;
           const user = await this.broadcastHelperService.findUserById(request.userId);
           if(!user || user.status!=UserStatus.ACTIVE){
               broadcastProcessRequest.success = false,
               broadcastProcessRequest.errorMessage ='User either does not exist or is not active'
               return canSchedule;
           }
           broadcastProcessRequest.user = user;
           
           const broadcast = await this.broadcastHelperService.findBroadcastById(request.broadcastId);
           if(!broadcast || broadcast.status !=BroadcastContactStatus.RUNNING){
              broadcastProcessRequest.success = false,
              broadcastProcessRequest.errorMessage =`Broadcast either does not exist or is not active`
              return canSchedule;
           }
           if(broadcast.timeZone == null){
            broadcast.timeZone = user.timeZone;
           }
           broadcastProcessRequest.broadcast = broadcast;

           const broadcastContact = await this.broadcastHelperService.findBroadcastContact(request.broadcastId, request.contactId);
           broadcastProcessRequest.broadcastContact = broadcastContact;
           
           return true;
        }
    
        /**
         * @param request 
         * @returns 
         */
        private async resumeBroadcastContact(request: ContactPauseResumeRequest){
            const data: any = {
                status: BroadcastContactStatus.RUNNING,
                entryDate: DateTime.now()
            }
            return await this.contactHelperService.updateBroadcastAndContact(request.broadcastId, request.contactId, data);
        }

}