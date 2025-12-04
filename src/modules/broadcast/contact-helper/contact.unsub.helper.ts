import { Injectable } from '@nestjs/common'
import { ContactHelperService } from './contact.helper.service'
import { BroadcastHelperService } from '../broadcast.helper.service'
import { BroadcastProcessRequest, BroadcastContactProcessResponse } from '../broadcast.requset';
import { BroadcastContactStatus, ContactPauseResumeRequest } from '@prisma/client'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from 'nestjs-prisma'
import { BroadcastService } from '../broadcast.service'


/**
 * @author @Milton
 */
@Injectable()
export class ContactUnsubHelper {
  constructor(
    private readonly contactHelperService: ContactHelperService,
    private readonly broadcastService: BroadcastService,
    private readonly logger: PinoLogger
  ) { }

  public async processContactUnsubRequest(contactPauseResumeRequest: ContactPauseResumeRequest) : Promise<BroadcastContactProcessResponse> {

    const unsubContactFromBroadcast = await this.unsubContactFromBroadcast(contactPauseResumeRequest);
    this.logger.info("unsubcontact: ", unsubContactFromBroadcast);
    const broadcastProcessRequest: BroadcastContactProcessResponse = {} as BroadcastContactProcessResponse;
    broadcastProcessRequest.action = contactPauseResumeRequest.action;
    broadcastProcessRequest.success = false;
    if (unsubContactFromBroadcast) {
      broadcastProcessRequest.success = true;
      await this.removeQueue(contactPauseResumeRequest);
      await this.broadcastService.incrementUnsubscribedCount(contactPauseResumeRequest.broadcastId);
    }
    return broadcastProcessRequest;

  }

  async unsubContact(contactPauseResumeRequest: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest) {

    const unsubContactFromBroadcast = await this.unsubContactFromBroadcast(contactPauseResumeRequest);
    this.logger.info("unsubcontact: ", unsubContactFromBroadcast);
    if (!unsubContactFromBroadcast) {
      broadcastProcessRequest.success = false,
        broadcastProcessRequest.errorMessage = `Failed to unsub contact: ${contactPauseResumeRequest.contactId} from broadcast: ${contactPauseResumeRequest.broadcastId}`;
      return broadcastProcessRequest;
    }

    await this.broadcastService.incrementUnsubscribedCount(contactPauseResumeRequest.broadcastId);

    await this.removeQueue(contactPauseResumeRequest);
    return broadcastProcessRequest;
  }



  /**
     * @param request 
     * @returns 
     */
  private async unsubContactFromBroadcast(request: ContactPauseResumeRequest) {
    const data: any = {
      status: BroadcastContactStatus.UNSUBSCRIBE,
    }
    return await this.contactHelperService.updateBroadcastAndContact(request.broadcastId, request.contactId, data);
  }


  /** 
   * @param request 
   */
  private async removeQueue(request: ContactPauseResumeRequest) {
    const isRemovedBroadcastContactQueue = await this.contactHelperService.removeBroadcastContactQueue(request.broadcastId, request.contactId);
    console.log("isRemovedBroadcastContactQueue: {}", isRemovedBroadcastContactQueue);
  }

 

}
