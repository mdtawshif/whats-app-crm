import { Injectable } from "@nestjs/common";
import { ContactHelperService } from "./contact.helper.service";
import { BroadcastContactStatus, ContactPauseResumeRequest } from "@prisma/client";
import { BroadcastProcessRequest, BroadcastContactProcessResponse } from '../broadcast.requset';
import { BroadcastService } from "../broadcast.service";

/**
 * @author @Milton
 */
@Injectable()
export class ContactPauseHelper {

    constructor(
        private readonly contactHelperService: ContactHelperService,
        private readonly broadcastService: BroadcastService,

    ) { }

    public async executeContactPauseRequest(request: ContactPauseResumeRequest): Promise<BroadcastContactProcessResponse> {
        const pausedContactFromBroadcast = await this.pauseContactFromBroadcast(request);
        console.log("pausedContactFromBroadcast: ", pausedContactFromBroadcast);
        const broadcastProcessRequest: BroadcastContactProcessResponse = {} as BroadcastContactProcessResponse;
        broadcastProcessRequest.action = request.action;
        broadcastProcessRequest.success = false;

        if (pausedContactFromBroadcast) {
            broadcastProcessRequest.success = true;
            await this.broadcastService.incrementPausedCount(request.broadcastId);
            await this.removeQueue(request);
        }

        return broadcastProcessRequest;
    }

    async processContactPauseRequest(request: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest) {

        const pausedContactFromBroadcast = await this.pauseContactFromBroadcast(request);
        console.log("pausedContactFromBroadcast: ", pausedContactFromBroadcast);
        if (!pausedContactFromBroadcast) {
            broadcastProcessRequest.success = false,
                broadcastProcessRequest.errorMessage = `Failed to Pause Contact:${request.contactId} From Broadcast:${request.broadcastId}`
            return broadcastProcessRequest;
        }

        await this.broadcastService.incrementPausedCount(request.broadcastId);

        await this.removeQueue(request);
        return broadcastProcessRequest;
    }


    /**
     * @param request 
     * @returns 
     */
    private async pauseContactFromBroadcast(request: ContactPauseResumeRequest) {
        const data: any = {
            status: BroadcastContactStatus.PAUSED,
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