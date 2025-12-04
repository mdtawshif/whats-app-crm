import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { ContactForwardQueue, ContactForwardQueueStatus, ContactPauseResumeRequest, ContactPauseResumeRequestStatus } from "@prisma/client";
import { ConcurrencyLimiter } from "../concurrency.limiter";
import { ContactForwardSchedulerHelperService } from "./forward.scheduler.helper.service";
import { ContactForwardSchedulerWorker } from "./contact.forward.scheduler.worker";

/**
 * @author @Milton
 */
@Injectable()
export class ContactForwardQueueScheduler {

    private readonly BATCH_SIZE = 100;

    constructor(
        private readonly logger: PinoLogger,
        private readonly contactForwardSchedulerHelperService: ContactForwardSchedulerHelperService,
        private readonly contactForwardSchedulerWorker: ContactForwardSchedulerWorker,
        private readonly concurrentcyLimiter: ConcurrencyLimiter,
    ){}


    @Cron(CronExpression.EVERY_30_SECONDS)
    async contactForwardQueueScheduler(): Promise<void>{
        this.logger.info("started contactForwardQueueScheduler.....")
        console.log("started contactForwardQueueScheduler")
        
        try{
            let id:bigint = 0n;
            let hasNextRequest = true;
            this.logger.info("hasNextRequest: {}", hasNextRequest);
            console.log("hasNextRequest: {}", hasNextRequest);
            while(hasNextRequest){
                const contactForwardQueues: ContactForwardQueue[] = await this.contactForwardSchedulerHelperService.findPendingForwardQeues(id, this.BATCH_SIZE);
                this.logger.info("contactForwardQueues:... ", contactForwardQueues.length);
                if(!contactForwardQueues || contactForwardQueues.length === 0){
                    hasNextRequest = false;
                    break;
                }
                id = contactForwardQueues[contactForwardQueues.length -1].id;
                await this.processContactForwardQueues(contactForwardQueues);
            }
        }catch(error){
            this.logger.error('Failed to process broadcast contact-entry-queue', error);
        }
    }


    /**
     * @Process contact forward queues
     * @param contactForwardQueues 
     */
    private async processContactForwardQueues(contactForwardQueues: ContactForwardQueue[]){
        /**
         * @change status to processing
         */
        await this.changeStatus(contactForwardQueues);

        contactForwardQueues.map(request=>{
            this.concurrentcyLimiter.run(()=> this.contactForwardSchedulerWorker.processSchedulerForwardQueue(request));
        })
    }

    /**
     * @change request status to processing
     * @param contactForwardQueues 
     */
    private async changeStatus(contactForwardQueues: ContactForwardQueue[]){
        const data: any = {
            status: ContactForwardQueueStatus.PROCESSING,
        }
        const isProcessing = await this.contactForwardSchedulerHelperService.updateForwardQueuesByIds(contactForwardQueues.map(request=> request.id), data);
        this.logger.info("isProcessing: {}", isProcessing);
    }

}



