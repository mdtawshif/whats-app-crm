import { Injectable } from "@nestjs/common";
import { ContactStatus } from "@prisma/client";
import { retail_v2beta } from "googleapis";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class ContactRepository {

    constructor(
        private readonly logger: PinoLogger,
        private readonly prismaService: PrismaService,
    ){
        this.logger.setContext(ContactRepository.name);
    }

    /**
     * @Method to find active contact by id
     * @param contactId 
     * @returns 
     */
    async findActiveContactById(contactId: bigint){
        if(contactId == null){
            return null;
        }
        try{
            return await this.prismaService.contact.findUnique({
                where:{
                    id: contactId,
                    status: ContactStatus.ACTIVE
                }
            });
        }
        catch(error){
            this.logger.error(`Failed to find active contact by id: ${contactId}`, error);
        }
    }

}