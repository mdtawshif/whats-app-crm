import { Injectable } from "@nestjs/common";
import { ContactPauseResumeRequestStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class ContactPauseResumeRequestRepository {

    constructor(private readonly prisma: PrismaService,
    private readonly logger: PinoLogger){}


    /**
     * @find all pending requestss
     * @param id 
     * @param batchSize 
     * @returns 
     */
    async findPendingPauseResumeRequests(id: bigint, batchSize: number){
        try{

            return await this.prisma.contactPauseResumeRequest.findMany({
                where:{
                    id:{
                        gt:id
                    },
                    status: ContactPauseResumeRequestStatus.PENDING,
                },
                take:batchSize
            });

        }catch(error){
            this.logger.error(error);
        }
    }

    /**
         * @update status 
         * @param ids 
         * @param status 
         */
        async updateByIds(ids:bigint[], data: any){
            try{
               const isUpdated = await this.prisma.contactPauseResumeRequest.updateMany({
                    where:{
                        id:{
                            in:ids
                        }
                    },data:{
                       ...data,
                       processedAt: new Date()
                    }
                });
                return !!isUpdated;
            }catch(error){
                this.logger.error(error);
            }
        }

}