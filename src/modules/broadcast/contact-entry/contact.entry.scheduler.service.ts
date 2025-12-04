import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { FirstSettingSchdeulerService } from "../broadcast.scheduler.service/first.setting.scheduler.service";
import { RecurringSettingSchedulerService } from "../broadcast.scheduler.service/recurring.setting.scheduler.service";
import { BroadcastStatus } from "@prisma/client";
import { BroadcastHelperService } from "../broadcast.helper.service";

/**
 * @author @Milton
 */
@Injectable()
export class ContactEntrySchedulerService {

    constructor(
        private readonly logger: PinoLogger,
        private readonly firstSettingSchedulerService: FirstSettingSchdeulerService,
        private readonly recurringSettingSchedulerService: RecurringSettingSchedulerService,
        private readonly broadcastHelperService: BroadcastHelperService,
    ){
        this.logger.setContext(ContactEntrySchedulerService.name)
    }

    async scheduleQueue(broadcastProcessRequest: BroadcastProcessRequest){
        if(broadcastProcessRequest.broadcast.status != BroadcastStatus.RUNNING){
            broadcastProcessRequest.success = false;
            broadcastProcessRequest.errorMessage = `Failed to schedule any queue! Broadcast: ${broadcastProcessRequest.broadcast.id} is not running`;
            return;
        }

        /**
         * @schdeule recurring setting if any
         */
        await this.recurringSettingSchedulerService.processRecurringSettings(broadcastProcessRequest);

        await this.processFirstBroadcastSetting(broadcastProcessRequest);

    }

    /**
     * @Schedule queue for the firstsetting i.e either immediate or schedule settings
     * @param broadcastProcessRequest 
     */
    private async processFirstBroadcastSetting(broadcastProcessRequest: BroadcastProcessRequest){
        const broadcastContact = broadcastProcessRequest.broadcastContact;
        const broadcastSettingDTO = await this.broadcastHelperService.findBroadcastContactLastSettingId(broadcastContact.broadcastId, broadcastContact.contactId);
        const priority: number = broadcastSettingDTO ? broadcastSettingDTO.priority ?? -1 : -1;
        await this.firstSettingSchedulerService.processFirstSetting(broadcastProcessRequest, priority);
    }

}