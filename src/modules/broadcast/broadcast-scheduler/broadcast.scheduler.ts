import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { ConcurrencyLimiter } from "../concurrency.limiter";
import { BroadcastPauseResumeRequest, BroadcastPauseResumeRequestStatus } from '@prisma/client'
import { BroadcastSchedulerWorker } from "./broadcast.scheduler.worker";
import { BroadcastSchedulerService } from "./broadcast.scheduler.service";

/**
 * @author @Milton
 */
@Injectable()
export class BroadcastScheduler{

    private readonly BATACH_SIZE = 100;

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
        private readonly broadcastSchedulerService: BroadcastSchedulerService,
        private readonly concurrencyLimiter: ConcurrencyLimiter,
        private readonly broadcastSchedulerWorker: BroadcastSchedulerWorker,
    ){}


    @Cron(CronExpression.EVERY_30_SECONDS)
    async broadcastSheduler() : Promise<void>{

        try{

            console.log("broadcastSheduler started...")
            let hasNextRequest = true;
            let id: bigint = 0n
            
            while(hasNextRequest){

                const pendingRequests = await this.broadcastSchedulerService.findPendingPauseResumeRequest(id, this.BATACH_SIZE);
                console.log("pendingPauseResumeRequests: ",pendingRequests);
                if(!pendingRequests || pendingRequests.length ===0){
                    hasNextRequest = false;
                    break;
                }
                id = pendingRequests[pendingRequests.length - 1].id;
                
                await this.processPauseResumeRequests(pendingRequests);

            }

        }catch(error){
            this.logger.error(error);
        }

    }

    private async processPauseResumeRequests(requests: BroadcastPauseResumeRequest[]): Promise<void>{
        
        await this.broadcastSchedulerService.updateBroadcastPauseResumeRequestStatus(requests.map(request=>request.id), BroadcastPauseResumeRequestStatus.PROCESSING);

        requests.map(request=>{
            this.concurrencyLimiter.run(()=>
                this.broadcastSchedulerWorker.processPauseResumeRequests(request)
            )
        });

    }

}