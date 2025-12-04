import { Injectable } from "@nestjs/common";
import { ContactStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class GmailImportedContactRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ){
        this.logger.setContext(GmailImportedContactRepository.name);
    }

     async findActiveContactByGmailAccountId(userId: bigint, gmailAccountId: bigint, conId: bigint, batchSize: number): Promise<{contactId: bigint}[]>{
            try{
    
           return await this.prisma.gmailImportedContact.findMany({
                where:{
                    userId: userId,
                    gmailAccountId: gmailAccountId,
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
                this.logger.error(`Failed to fetch segment contact ${gmailAccountId}`);
            }
        }

}