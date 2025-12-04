import { Injectable } from "@nestjs/common";
import { BroadcastContactEntryQueue, BroadcastContactQueueSource, EntryStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { BroadcastContactEntryQueueDTO } from "../dto/broadcast.contact.entry.queue.dto";


@Injectable()
export class BroadcastContactEntryQueueRepository {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ){
        this.logger.setContext(BroadcastContactEntryQueueRepository.name);
    }

    /**
     * @Fetch pending contact entry request 
     * @param batchSize 
     * @param id 
     * @returns 
     */
    async findPendingEntries(id: bigint, batchSize: number): Promise<BroadcastContactEntryQueue[]> {
        if(id == null){
            return [];
        }
        try{
        return await this.prisma.broadcastContactEntryQueue.findMany({
            where: {
                id: {
                gt: id
                },
                status: EntryStatus.PENDING
            },
            orderBy: {
                id: 'asc'
            },
            take: batchSize
          })
        }catch(error){
            this.logger.error(error);
        }
      }

    async updateByIds(ids: bigint[], data:any){
        if(!ids || ids.length ===0 || data == null){
            return;
        }
        try{
            const totalUpdated = await this.prisma.broadcastContactEntryQueue.updateMany({
              where: {
                id: {
                  in: ids
                }
              },
              data: {
                ...data,
                processedAt: DateTime.now()
              }
            })
            return totalUpdated.count > 0
        }catch(error){
            this.logger.error(error);
        }

    }

    /**
     * @Add brodactContactEntryQueueInBatch
     * @param broadcastContactEntryQueues 
     * @returns 
     */
    async addBroadcastContactEntryQueueInBatch(broadcastContactEntryQueues: BroadcastContactEntryQueueDTO[]):Promise<Number>{
        if(!broadcastContactEntryQueues || broadcastContactEntryQueues.length ===0){
            return;
        }
        const broadcastContactEntryQueueList = broadcastContactEntryQueues.filter(queue => 
            queue.agencyId != null &&
            queue.userId != null &&
            queue.contactId != null &&
            queue.broadcastId != null
        );
        try{
            const data = broadcastContactEntryQueueList.map(broadcastContactEntry=>({
            agencyId: broadcastContactEntry.agencyId,
            userId: broadcastContactEntry.userId,
            createdBy: broadcastContactEntry.createdBy,
            broadcastId: broadcastContactEntry.broadcastId,
            contactId: broadcastContactEntry.contactId,
            sourceId: broadcastContactEntry.sourceId,
            contactSource: broadcastContactEntry.contactSource || BroadcastContactQueueSource.CONTACT,
            status: broadcastContactEntry.status || EntryStatus.PENDING,
            requestedAt: new Date(),
            processedAt: new Date(),
            }));
            const result = await this.prisma.broadcastContactEntryQueue.createMany({
                data,
                skipDuplicates:true,
            })
            return result.count;
        }catch(error){
            this.logger.error(`Failed to add broadcastcontactEntry`);
        }
    }
}