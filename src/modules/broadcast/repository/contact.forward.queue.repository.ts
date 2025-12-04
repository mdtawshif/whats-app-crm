import { Injectable } from "@nestjs/common";
import { ContactForwardQueueStatus, Prisma } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { ContactForwardQueueDTO } from "../dto/broadcast.dto";

@Injectable()
export class ContactForwardQueueRepository {
    
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
    ) { 
        this.logger.setContext(ContactForwardQueueRepository.name);
    }

    /**
     * @Find pending forward queues
     * @param id 
     * @param limit 
     * @returns 
     */
    async findPendingQueues(id: bigint, limit: number){
        if(id == null){
            return [];
        }
        try{
           return await this.prisma.contactForwardQueue.findMany({
                where:{
                    id:{
                        gt:id
                    },
                    status: ContactForwardQueueStatus.PENDING
                },take:limit
            })                

        }catch(error){
            this.logger.error('Failed to fetch pending contact forward queues', error);
        }
    }

    /**
     * @Update status by ids
     * @param ids 
     * @param data 
     */
    async updateByIds(ids:bigint[], data: any) {
        try {
            const totalUpdated = await this.prisma.contactForwardQueue.updateMany({
                where: {
                    id: {
                        in: ids
                    }
                }, data: {
                     ...data,
                    processedAt: new Date()
                }
            });
            return totalUpdated.count > 0;
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
         * @Milton463
         * @param dto 
         * @returns 
         */
        async addContactForwardQueue(dto: ContactForwardQueueDTO) {
            try {
              return await this.prisma.contactForwardQueue.create({
                data: {
                  agencyId: dto.agencyId,
                  userId: dto.userId,
                  contactId: dto.contactId,
                  broadcastId: dto.broadcastId,
                  broadcastSettingId: dto.broadcastSettingId,
                  status: dto.status ? dto.status: ContactForwardQueueStatus.PENDING, 
                  failedReason: dto.failedReason ? dto.failedReason : null,
                  requestedAt: new Date(),
                  processedAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              })
            } catch (error) {
                this.logger.error(error);
            }
      }

}