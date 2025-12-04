import { Injectable } from "@nestjs/common";
import { ContactStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class ContactTagService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
    ){}

    async findActiveTagContacts(userId: bigint, tagId: bigint, conId: bigint, batchSize: number):Promise<{contactId: bigint}[]>{

        try{
            return await this.prisma.contactTag.findMany({
                where:{
                    tagId: tagId,
                    contact:{
                        userId:userId,
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
                    contactId: true
                }
            })

        }catch(error){
            this.logger.error(error);
        }   
    }
}