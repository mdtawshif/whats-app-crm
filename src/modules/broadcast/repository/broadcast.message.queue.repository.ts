import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { BroadcastMessageQueueDTO } from "../dto/broadcast.message.queue.dto";
import { BroadcastMessageQueue, MessagingProduct, QueueStatus } from "@prisma/client";


@Injectable()
export class BroadcastMessageQueueRepository {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ){}


    /**
     * @remove all queues against a broadcast
     * @param broadcastId 
     */
    async removeBroadcastQueues(broadcastId: bigint){
        let totalDeleted = 0;
        let DELETED_QUEUE_BATCH_SIZE = 100;
         try{
            do {
            totalDeleted = await this.prisma.$executeRawUnsafe(`
                    DELETE FROM broadcast_message_queues 
                    WHERE broadcast_id=?
                    LIMIT ?`,
                    broadcastId,
                    DELETED_QUEUE_BATCH_SIZE
                )
            }while(totalDeleted > 0);
        }catch(error){
            this.logger.error(error);
        }
    }

    /**
     * @remove all queues against a broadcast
     * @param broadcastId 
     */
    async removeBroadcastContactQueue(broadcastId: bigint, contactId: bigint):Promise<boolean>{
         try{
            const isRemoved = await this.prisma.broadcastMessageQueue.deleteMany({
                where:{
                    broadcastId: broadcastId,
                    contactId: contactId
                }
            });
            return isRemoved.count > 0;
        }catch(error){
            this.logger.error(error);
        }
    }

    async addBroadcastMessageQueueInBatch(broadcastMessageQueues: BroadcastMessageQueueDTO[]):Promise<Number>{
            if(!broadcastMessageQueues || broadcastMessageQueues.length ===0){
                return;
            }
            let insertedCount = 0;
            broadcastMessageQueues = broadcastMessageQueues.filter(queue => {
            return (
                    queue.agencyId != null &&
                    queue.userId != null &&
                    queue.broadcastId != null &&
                    queue.contactId != null &&
                    queue.broadcastSettingId != null &&
                    queue.waBusinessNumberId != null &&
                    queue.sentAt != null &&
                    queue.messageType != null
                );
            });

            for(const broadcastMessageQueue of broadcastMessageQueues){
                const data = {
                    agencyId: broadcastMessageQueue.agencyId,
                    userId: broadcastMessageQueue.userId,
                    broadcastId: broadcastMessageQueue.broadcastId,
                    contactId: broadcastMessageQueue.contactId,
                    broadcastSettingId: broadcastMessageQueue.broadcastSettingId,
                    waBusinessNumberId: broadcastMessageQueue.waBusinessNumberId,
                    status: broadcastMessageQueue.status || QueueStatus.PENDING,
                    sentAt: broadcastMessageQueue.sentAt.toJSDate(),
                    failedReason: broadcastMessageQueue.failedReason || '',
                    messageType: broadcastMessageQueue.messageType,
                    messagingProduct: broadcastMessageQueue.messagingProduct || MessagingProduct.WHATS_APP,
                    response: broadcastMessageQueue.response || null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                console.log('data: ', data)
                try {
                  const inserted = await this.prisma.broadcastMessageQueue.create({ data })
                  console.log('inserted: ', inserted)
                  insertedCount++
                } catch (error) {
                  this.logger.error(`Failed to add broadcastcontact`)
                  console.log(error)
                }
                console.log('insertedCount: ', insertedCount)
                return insertedCount
        }
    }

    /**
     * 
     * @param broadcastId 
     * @param contactId 
     * @param broadcastSettingId 
     * @returns 
     */
    async hasMessageQueueEntry(broadcastId: bigint, contactId: bigint, broadcastSettingId: bigint): Promise<boolean> {
        if (!broadcastId ||
            !contactId ||
            !broadcastSettingId) {
            return false;
        }

        try {
            const entry = await this.prisma.broadcastMessageQueue.findFirst({
            where: {
                broadcastId: broadcastId,
                contactId: contactId,
                broadcastSettingId: broadcastSettingId,
            },
            select: { id: true },
            });
            return entry !== null;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * 
     * @param broadcastId 
     * @param contactId 
     * @param broadcastSettingId 
     * @returns 
     */
    async hasPendingMessageQueueEntry(broadcastId: bigint, contactId: bigint, broadcastSettingId: bigint): Promise<boolean> {
        if (!broadcastId ||
            !contactId ||
            !broadcastSettingId) {
            return false;
        }

        try {
            const entry = await this.prisma.broadcastMessageQueue.findFirst({
            where: {
                broadcastId: broadcastId,
                contactId: contactId,
                broadcastSettingId: broadcastSettingId,
                status: QueueStatus.PENDING
            },
            select: { id: true },
            });
            return entry !== null;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @Milton463
     * @param id 
     * @param limit 
     */
    async findPendingQueues(id: bigint, limit: number): Promise<BroadcastMessageQueue[]> {
        try {
            const queues = await this.prisma.broadcastMessageQueue.findMany({
                where: {
                    id:{
                        gt:id
                    },
                    status: QueueStatus.PENDING,
                    sentAt:{
                        lte: new Date()
                    }
                },
                orderBy: {
                    sentAt: 'asc',
                },
                take: limit
            });
            return queues;
        }catch(error){
            this.logger.error(error);
        }
    }

    /**
     * @Milton463
     * @param id 
     * @param data 
     * @returns 
     */
    async updateByIds(id: bigint[], data: any): Promise<boolean> {
        if(!id || !data){
            return false;
        }
        try{
            const result = await this.prisma.broadcastMessageQueue.updateMany({
                where:{
                    id:{
                        in: id
                    }
                },
                data: {
                    ...data,
                    updatedAt: new Date()
                }
            });
            return result.count > 0;
        }catch(error){
            this.logger.error(error);
            return false;
        }
    }
    /**
     * @Milton463
     * @param id 
     * @param data 
     * @returns 
     */
    async update(id: bigint, data: any): Promise<boolean> {
        if(!id || !data){
            return false;
        }
        try{
            const result = await this.prisma.broadcastMessageQueue.updateMany({
                where:{
                    id: id
                },
                data: {
                    ...data,
                    updatedAt: new Date()
                }
            });
            return result.count > 0;
        }catch(error){
            this.logger.error(error);
            return false;
        }
    }

    /**
     * @remove all queues against a broadcast
     * @param broadcastId 
     */
    async removeBroadcastMessageQueueById(id: bigint):Promise<boolean>{
         try{
            const isRemoved = await this.prisma.broadcastMessageQueue.deleteMany({
                where:{
                    id: id
                }
            });
            return isRemoved.count > 0;
        }catch(error){
            this.logger.error(error);
        }
    }
}