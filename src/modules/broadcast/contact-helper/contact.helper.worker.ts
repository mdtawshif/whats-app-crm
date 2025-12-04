import { Injectable } from "@nestjs/common";
import { ContactHelperService } from "./contact.helper.service";
import { ContactAction, ContactPauseResumeRequest, ContactPauseResumeRequestStatus } from "@prisma/client";
import { ContactPauseHelper } from "./contact.pause.helper";
import { ContactOptoutHelper } from "./contact.optout.helper";
import { ContactResumeHelper } from "./contact.resume.helper";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { ContactUnsubHelper } from "./contact.unsub.helper";
import { PinoLogger } from "nestjs-pino";

/**
 * @author @Milton
 */
@Injectable()
export class ContactHelperWorker {

    constructor(
        private readonly contactHelperService: ContactHelperService,
        private readonly contactPauserHelper: ContactPauseHelper,
        private readonly contactOptoutHelper: ContactOptoutHelper,
        private readonly contactResumeHelper: ContactResumeHelper,
        private readonly contactUnsubHelper: ContactUnsubHelper,
        private readonly logger: PinoLogger,
    ){
        this.logger.setContext(ContactHelperWorker.name);
    }

    async processContactPauseResumeRequest(contactPauseResumerRequest: ContactPauseResumeRequest){
        let broadcastProcessRequest ={
            success:true,
            broadcastSettingDTO:null,
            broadcast:null,
            broadcastContact: null,
            broadcastId: null,
            user: null
        }

        const action = contactPauseResumerRequest.action;
        this.logger.info("contactAction: ", action);
        switch(action){
            case ContactAction.PAUSE:{
              broadcastProcessRequest = await this.contactPauserHelper.processContactPauseRequest(contactPauseResumerRequest, broadcastProcessRequest);
              break;
            }
            case ContactAction.RESUME:{
                broadcastProcessRequest = await this.contactResumeHelper.processContactResumeRequest(contactPauseResumerRequest, broadcastProcessRequest);
                break;
            }
            case ContactAction.OPT_OUT:{
               broadcastProcessRequest = await this.contactOptoutHelper.processContactPauseRequest(contactPauseResumerRequest, broadcastProcessRequest);
                break;
            }
            case ContactAction.UNSUBSCRIBE:{
               broadcastProcessRequest = await this.contactUnsubHelper.unsubContact(contactPauseResumerRequest, broadcastProcessRequest);
               break;
            }
            default:{
                break
            }
        }
        
        await this.changeStatus(contactPauseResumerRequest, broadcastProcessRequest);
    }

    private async changeStatus(contactPauseResumeRequest: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){
        const data: any = {
            status: broadcastProcessRequest.success ? ContactPauseResumeRequestStatus.COMPLETED: ContactPauseResumeRequestStatus.FAILED,
            failedReason: broadcastProcessRequest.errorMessage||''
        }
        let ids: bigint[] = [contactPauseResumeRequest.id];
        const isProcessed = await this.contactHelperService.updatecontactPauseResumeRequestByIds(ids, data);
        console.info("isProcessed: {}", isProcessed);
    }
}