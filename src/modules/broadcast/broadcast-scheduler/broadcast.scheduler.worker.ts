import { Injectable } from "@nestjs/common";
import { BroadcastPauseResumeRequest, BroadcastPauseResumeRequestStatus, PauseResumeAction } from "@prisma/client";
import { BroadcastPauseScheduler } from "./broadcast.pause.scheduler";
import { PrismaService } from "nestjs-prisma";
import { PinoLogger } from "nestjs-pino";
import { BroadcastPauseResumeRequestRepository } from "../repository/broadcast.pause.resume.request.repository";
import { BroadcastSchedulerService } from "./broadcast.scheduler.service";
import { BroadcastResumeScheduler } from "./broadcast.resume.scheduler";
import { BroadcastSchedulerProcessResponse } from "./broadcast.scheduler.process.response";
import { BroadcastProcessRequest } from "../broadcast.requset";

/**
 * @author @Milton
 */
@Injectable()
export class BroadcastSchedulerWorker {

    constructor(
        private readonly logger: PinoLogger,
        private readonly broadcastPauseScheduler: BroadcastPauseScheduler,
        private readonly broadcastResumeScheduler: BroadcastResumeScheduler,
        private readonly broadcastSchdulerService: BroadcastSchedulerService
    ) { }

    async processPauseResumeRequests(broadcastPauseResumeRequest: BroadcastPauseResumeRequest) {

        let broadcastProcessRequest ={
            success:true,
            broadcastSettingDTO:null,
            broadcast:null,
            broadcastContact: null,
            broadcastId: null,
            user: null
        }

        const action = broadcastPauseResumeRequest.action;
        console.log("action: ", action);
        switch (action) {
            case PauseResumeAction.PAUSE: {
                broadcastProcessRequest = await this.broadcastPauseScheduler.processPauseRequest(broadcastPauseResumeRequest, broadcastProcessRequest);
                break;
            }
            case PauseResumeAction.PAUSED_FOR_CREDIT: {
                broadcastProcessRequest = await this.broadcastPauseScheduler.processPauseRequest(broadcastPauseResumeRequest, broadcastProcessRequest);
                break;
            }
            case PauseResumeAction.RESUME: {
                broadcastProcessRequest = await this.broadcastResumeScheduler.processResumeRequest(broadcastPauseResumeRequest, broadcastProcessRequest);
                break;
            }
            default: break;
        }

        await this.changeStatus(broadcastPauseResumeRequest, broadcastProcessRequest);
    }

    /**
    * @change requests status as completed
    */
    private async changeStatus(broadcastPauseResumeRequest: BroadcastPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest) {
        const data: any = {
            status: broadcastProcessRequest.success ? BroadcastPauseResumeRequestStatus.COMPLETED : BroadcastPauseResumeRequestStatus.FAILED,
            failedReason: broadcastProcessRequest.errorMessage || ''
        }
        let ids: bigint[] = [broadcastPauseResumeRequest.id];
        const isProcessed = await this.broadcastSchdulerService.updateBroadcastPauseResumeRequest(ids, data);
        console.info("isProcessed:", isProcessed);
    }
}