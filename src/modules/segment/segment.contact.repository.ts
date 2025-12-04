import { Injectable } from "@nestjs/common";
import { ContactStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class SegmentContactRepository {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
    ){}

    async findActiveContactBySegmentId(userId: bigint, segmentId: bigint, conId: bigint, batchSize: number): Promise<{contactId: bigint}[]>{
        try{

       return await this.prisma.segmentContact.findMany({
            where:{
                userId:userId,
                segmentId:segmentId,
                contact:{
                    status: ContactStatus.ACTIVE
                },
                contactId:{
                    gt:conId
                }
            },
            orderBy:{
                contactId:'asc'
            },
            take: batchSize,
            select:{
                contactId:true
            }
        })
        }catch(error){
            this.logger.error(`Failed to fetch segment contact ${segmentId}`);
        }

    }


}