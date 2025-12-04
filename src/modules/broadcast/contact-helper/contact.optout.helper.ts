import { Injectable } from "@nestjs/common";
import { ContactHelperService } from "./contact.helper.service";
import { BroadcastContactStatus, ContactPauseResumeRequest } from "@prisma/client";
import { BroadcastProcessRequest, BroadcastContactProcessResponse } from '../broadcast.requset';
import { RequestUser, BasicUser } from '../../user/dto/user.dto';
import { PrismaService } from "nestjs-prisma";
import { BroadcastService } from '../broadcast.service';

/**
 * @author @Milton
 */
@Injectable()
export class ContactOptoutHelper {

    constructor(
        private readonly prisma: PrismaService,
        private readonly contactHelperService: ContactHelperService,
        private readonly broadcastService: BroadcastService,
    ){}

    public async processContactOptoutRequest(request: ContactPauseResumeRequest): Promise<BroadcastContactProcessResponse>{
        const optOutContactFromBroadcast =  await this.optOutContactFromBroadcast(request);
        console.log("optoutContactFromBroadcast: ", optOutContactFromBroadcast);
        const broadcastProcessRequest: BroadcastContactProcessResponse = {} as BroadcastContactProcessResponse;
        broadcastProcessRequest.action = request.action;
        broadcastProcessRequest.success = false;
        if (optOutContactFromBroadcast) {
            broadcastProcessRequest.success = true;
            const user : BasicUser = await this.prisma.user.findFirst({
                where: {
                    id: request.createdBy
                },
                select : {
                    id: true,
                    parentUserId: true,
                    agencyId: true,
                    status : true
                }
            });
            await this.removeQueue(request);
            await this.addOptoutContact(user, request);
            await this.broadcastService.incrementOptoutCount(request.broadcastId);
        }
        return broadcastProcessRequest;
    }

    public async processContactPauseRequest(request: ContactPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){

        const pausedContactFromBroadcast =  await this.optOutContactFromBroadcast(request);
        console.log("optoutContactFromBroadcast: ", pausedContactFromBroadcast);
        if(!pausedContactFromBroadcast){
            broadcastProcessRequest.success = false,
            broadcastProcessRequest.errorMessage =`Failed to optout Contact:${request.contactId} From Broadcast:${request.broadcastId}`
            return broadcastProcessRequest;
        }
        const user: BasicUser = await this.prisma.user.findFirst({
            where: {
                id: request.createdBy
            },
            select: {
                id: true,
                parentUserId: true,
                agencyId: true,
                status: true
            }
        });
        await this.removeQueue(request);
        await this.addOptoutContact(user, request);
        return broadcastProcessRequest;
    }


    /**
     * @param request 
     * @returns 
     */
    private async optOutContactFromBroadcast(request: ContactPauseResumeRequest){
        const data: any = {
            status: BroadcastContactStatus.OPT_OUT,
        }
        return await this.contactHelperService.updateBroadcastAndContact(request.broadcastId, request.contactId, data);
    }

    /** 
     * @param request 
     */
    private async removeQueue(request: ContactPauseResumeRequest){
        const isRemovedBroadcastContactQueue = await this.contactHelperService.removeBroadcastContactQueue(request.broadcastId, request.contactId);
        console.log("isRemovedBroadcastContactQueue: {}", isRemovedBroadcastContactQueue);
    }

    private async addOptoutContact(user: BasicUser, request: ContactPauseResumeRequest){
        const optOutContact = {
            userId: request.userId,
            agencyId: request.agencyId,
            contactId: request.contactId,
            reason:'opt-out by user'
        }
        const optoutContactId = await this.contactHelperService.addOptoutContact(user, optOutContact);
        console.log("optoutContactId: ", optoutContactId);
    }

}