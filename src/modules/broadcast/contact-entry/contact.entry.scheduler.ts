import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import { ContactEntryQueueProcessor } from "./contact.entry.queue.processor";
import { ContactEntryHelperService } from "./contact.entry.helper.service";
import { BroadcastContactEntryQueue, EntryStatus } from "@prisma/client";
import { ConcurrencyLimiter } from "../concurrency.limiter";
import { ContactEntryWorker } from "./contact.entry.worker";

/**
 * @author @Milton
 */
@Injectable()
export class ContactEntryScheduler {

    private readonly QUEUE_BATCH_SIZE = 100;

    constructor(
        private readonly logger: PinoLogger,
        private readonly contactEntyHelperService: ContactEntryHelperService,
        private readonly concurrencyLimiter: ConcurrencyLimiter,
        private readonly contactEntryWorker: ContactEntryWorker
    ) { }


    @Cron(CronExpression.EVERY_10_SECONDS)
    async contactEntryScheduler(): Promise<void> {
        try {
            this.logger.info("contactEntry shcheduler started.....")
            console.log("started contactEntry shcheduler.....")

            let id: bigint = 0n;
            let hasNextRequest = true;

            while(hasNextRequest){
                const broadcastContactEntryRequests: BroadcastContactEntryQueue[] = await this.contactEntyHelperService.findPendingContactEntryQueueRequests(id, this.QUEUE_BATCH_SIZE);
                if(!broadcastContactEntryRequests || broadcastContactEntryRequests.length ===0){
                    hasNextRequest = false;
                    break;
                }
                id = broadcastContactEntryRequests[broadcastContactEntryRequests.length - 1].id;
             
                await this.processBroadcastContactEntryRequests(broadcastContactEntryRequests);

            }
        } catch (error) {
            this.logger.error('Failed to process broadcast contact-entry-queue', error);
        }
    }

    /**
     * @process contact entry request
     * @param broadcastContactEntryRequests 
     */
    private async processBroadcastContactEntryRequests(broadcastContactEntryRequests: BroadcastContactEntryQueue[]){
        const data: any = {
            status: EntryStatus.PROCESSING,
        }
        await this.contactEntyHelperService.updateContactEntryQueueRequest(broadcastContactEntryRequests.map(request=>request.id), data);

        broadcastContactEntryRequests.map(request=>{
            this.concurrencyLimiter.run(()=> this.contactEntryWorker.processContactEntry(request));
        });
    }


}



