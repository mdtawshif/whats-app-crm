import { Injectable } from "@nestjs/common";
import { ContactStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class ContactImportQueueContactRepository {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
    ){}


    async findActiveImportedContacts(userId: bigint, queueId: bigint, conId: bigint, batchSize: number){
        try{
            return await this.prisma.contactImportQueueContact.findMany({
                where:{
                    userId: userId,
                    queueId: queueId,
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
                take:batchSize
            });
        }catch(error){
            this.logger.error(error);
        }
    }

}