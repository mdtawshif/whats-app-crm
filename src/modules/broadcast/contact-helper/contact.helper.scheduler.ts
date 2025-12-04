import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { ContactHelperService } from "./contact.helper.service";
import { ContactPauseResumeRequest, ContactPauseResumeRequestStatus } from "@prisma/client";
import { ConcurrencyLimiter } from "../concurrency.limiter";
import { ContactHelperWorker } from "./contact.helper.worker";

/**
 * @author @Milton
 */
@Injectable()
export class ContactHelperScheduler {

    private readonly BATCH_SIZE = 100;

    constructor(
        private readonly logger: PinoLogger,
        private readonly contactHelperService: ContactHelperService,
        private readonly concurrentcyLimiter: ConcurrencyLimiter,
        private readonly contactHelperWorker: ContactHelperWorker,
    ){}


    @Cron(CronExpression.EVERY_30_SECONDS)
    async contactPauseResumeScheduler(): Promise<void>{
        this.logger.info("started contactEntry shcheduler.....")
        console.log("started contactHelper shcheduler.....")
        
        try{
            let id:bigint = 0n;
            let hasNextRequest = true;
            
            while(hasNextRequest){
                const contactPauseResumeRequests = await this.contactHelperService.findPendingPauseResumeRequests(id, this.BATCH_SIZE);
                console.log("contactPauseResumeRequests: ", contactPauseResumeRequests);
                if(!contactPauseResumeRequests || contactPauseResumeRequests.length === 0){
                    hasNextRequest = false;
                    break;
                }
                id = contactPauseResumeRequests[contactPauseResumeRequests.length -1].id;
                await this.processContactPauseResumeRequest(contactPauseResumeRequests);
            }

        }catch(error){
            this.logger.error('Failed to process broadcast contact-entry-queue', error);
        }
    }


    private async processContactPauseResumeRequest(contactPauseResumeRequests: ContactPauseResumeRequest[]){
        /**
         * @change status to processing
         */
        await this.changeStatus(contactPauseResumeRequests);

        contactPauseResumeRequests.map(request=>{
            this.concurrentcyLimiter.run(()=> this.contactHelperWorker.processContactPauseResumeRequest(request));
        })

    }

    /**
     * @change request status to processing
     * @param contactPauseResumeRequests 
     */
    private async changeStatus(contactPauseResumeRequests: ContactPauseResumeRequest[]){
        const data: any = {
            status: ContactPauseResumeRequestStatus.PROCESSING,
        }
        const isProcessing = await this.contactHelperService.updatecontactPauseResumeRequestByIds(contactPauseResumeRequests.map(request=> request.id), data);
        this.logger.info("isProcessing: {}", isProcessing);
    }

}



