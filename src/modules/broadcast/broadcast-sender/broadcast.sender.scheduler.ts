import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { tryCatch } from "bullmq";
import { PinoLogger } from "nestjs-pino";
import { BroadcastMessageQueueRepository } from "../repository/broadcast.message.queue.repository";
import { BroadcastMessageQueue, QueueStatus } from "@prisma/client";
import { BroadcastSendHelperService } from "./broadcast.send.helperService";
import { ConcurrencyLimiter } from "../concurrency.limiter";
import { BroadcastSendMessageQeueueWorker } from "./broadcast.send.workder";

@Injectable()
export class BroadcastSenderScheduler {

    private readonly QUEUE_BATCH_SIZE = 20;

    constructor(
        private readonly loggger: PinoLogger,
        private readonly broadcastSendHelperService: BroadcastSendHelperService,
        private readonly concurrencyLimiter: ConcurrencyLimiter,
        private readonly broadcastSendMessageQeueueWorker: BroadcastSendMessageQeueueWorker
    ){
        this.loggger.setContext(BroadcastSenderScheduler.name);
    }


    @Cron(CronExpression.EVERY_10_SECONDS)
    async scheduleNextBroadcastSender(){
        console.log('scheduleNextBroadcastSender started ..............');
        try{
            
            let id: bigint = 0n;
            let hasNextQueue: boolean = true;

            while(hasNextQueue){
                const queues = await this.broadcastSendHelperService.findPendingBroadcastMessageQueues(id, this.QUEUE_BATCH_SIZE);
                if(!queues || queues.length === 0){
                    hasNextQueue = false;
                    break;
                }

                id = queues[queues.length -1].id;

                await this.processBroadcastMessageQueue(queues);

            }    

        }catch(error){
            this.loggger.error(error);
        }
    }

    /**
     * @process message queue
     */
    private async processBroadcastMessageQueue(queues: BroadcastMessageQueue []){
        await this.changeStatus(queues);

        queues.map(queue=>{
            this.concurrencyLimiter.run(()=>
                this.broadcastSendMessageQeueueWorker.processBroadcastMessageQueue(queue)
            )
        });
    }

    private async changeStatus(queues: BroadcastMessageQueue[]){
        const ids: bigint[] = queues.map(q=>q.id);
        const data:any = {
            status: QueueStatus.PROCESSING
        }
        const processingMessageQueueStatus: boolean = await this.broadcastSendHelperService.changeBroadcastMessageQueueStatus(ids, data);
        this.loggger.info(`Processing message queue status changed: ${processingMessageQueueStatus}`);
    }

}