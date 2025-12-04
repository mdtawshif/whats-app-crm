import { Injectable } from "@nestjs/common";
import { BroadcastPauseResumeRequest, BroadcastPauseResumeRequestStatus, BroadcastStatus, ContactAction, PauseResumeAction } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { BroadcastSchedulerService } from "./broadcast.scheduler.service";
import { BroadcastSchedulerProcessResponse } from "./broadcast.scheduler.process.response";
import { BroadcastProcessRequest } from "../broadcast.requset";

/**
 * @author @Milton
 */
@Injectable()
export class BroadcastPauseScheduler {

    private readonly DELETED_QUEUE_BATCH_SIZE = 100
    
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger:PinoLogger,
        private readonly broadcastSchedulerService: BroadcastSchedulerService,
    ){}

     async processPauseRequest(broadcastPauseResumeRequest: BroadcastPauseResumeRequest, broadcastProcessRequest: BroadcastProcessRequest){
       
        /**
        * @mark broadcast as paused
        */
       const broadcastPaused = await this.pausedBroadcast(broadcastPauseResumeRequest);
       console.log("broadcastPaused: ", broadcastPaused);
       if(!broadcastPaused){
          broadcastProcessRequest.success = false,
          broadcastProcessRequest.errorMessage = `Failed to pause broadcast: ${broadcastPauseResumeRequest.id}`
          return broadcastProcessRequest;
       }

        /**
         * @remove all queues 
         */
       if(broadcastPaused){
          await this.broadcastSchedulerService.removeBroadcastQueues(broadcastPauseResumeRequest.broadcastId);
       }
       return broadcastProcessRequest;
    }

    async pausedBroadcast(broadcastPauseResumeRequest: BroadcastPauseResumeRequest){
      const data: any = {
        status: broadcastPauseResumeRequest.action === PauseResumeAction.PAUSED_FOR_CREDIT ? BroadcastStatus.PAUSED_FOR_CREDIT: BroadcastStatus.PAUSED,
        pausedAt:new Date()
      }
      return await this.broadcastSchedulerService.changeBroadcastStatus(broadcastPauseResumeRequest.broadcastId, data);
    }

}