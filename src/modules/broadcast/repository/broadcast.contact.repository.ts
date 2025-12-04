import { Injectable } from "@nestjs/common";
import { BroadcastContact, BroadcastContactSource, BroadcastContactStatus, ContactStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { BroadcastContactDTO } from "../dto/broadcastContactDTO";
import { log } from "console";
import { binaryauthorization_v1 } from "googleapis";
import { EmailProvider } from "src/modules/email/email.provider";

@Injectable()
export class BroadcastContactRepository {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
    ) { }

    async addBroadcastContact(broadcast: BroadcastContactDTO) {
        try {
            const bContact = await this.prisma.broadcastContact.create({
                data: {
                    agencyId: broadcast.agencyId,
                    userId: broadcast.userId,
                    broadcastId: broadcast.broadcastId,
                    contactId: broadcast.contactId,
                    entryDate: broadcast.entryDate || new Date(),
                    contactSource: broadcast.contactSource || BroadcastContactSource.SINGLE,
                    status: broadcast.status || BroadcastContactStatus.RUNNING,
                    lastMessageAt: broadcast.lastMessageAt,
                    nextAllowedMessageAt: broadcast.nextAllowedMessageAt,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });

            return bContact;
        } catch (error) {
            this.logger.error(`Failed to addBroadcast contact: ${error.message}`);
        }
    }

    async addBroadcastContactInBatch(broadcastContacts: BroadcastContactDTO[]): Promise<Number> {
        if (!broadcastContacts || broadcastContacts.length === 0) {
            return;
        }
        try {
            const data = broadcastContacts.map(broadcastContact => ({
                agencyId: broadcastContact.agencyId,
                teamId: broadcastContact.teamId,
                userId: broadcastContact.userId,
                broadcastId: broadcastContact.broadcastId,
                contactId: broadcastContact.contactId,
                entryDate: broadcastContact.entryDate || new Date(),
                contactSource: broadcastContact.contactSource || BroadcastContactSource.SINGLE,
                status: broadcastContact.status || BroadcastContactStatus.RUNNING,
                lastMessageAt: broadcastContact.lastMessageAt,
                nextAllowedMessageAt: broadcastContact.nextAllowedMessageAt,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));
            const result = await this.prisma.broadcastContact.createMany({
                data,
                skipDuplicates: true,
            })
            return result.count;
        } catch (error) {
            this.logger.error(`Failed to add broadcastcontact`);
        }
    }

    /**
     * 
     * @param broadcastId 
     * @param conId 
     * @param limit 
     * @returns 
     */
    async findActiveBroadcastContacts(broadcastId: bigint, conId: bigint, limit: number): Promise<BroadcastContact[]> {
        if (broadcastId == null) {
            return [];
        }
        try {
            const broadcastContacts = await this.prisma.$queryRaw<BroadcastContact[]>`
            SELECT 
                bc.id,
                bc.agency_id AS "agencyId",
                bc.user_id AS "userId",
                bc.broadcast_id AS "broadcastId",
                bc.contact_id AS "contactId",
                bc.entry_date AS "entryDate",
                bc.contact_source AS "contactSource",
                bc.status AS "status",
                bc.last_message_at AS "lastMessageAt",
                bc.next_allowed_message_at AS "nextAllowedMessageAt",
                bc.created_at AS "createdAt",
                bc.updated_at AS "updatedAt"
            FROM broadcast_contacts bc
            INNER JOIN contacts c ON c.id = bc.contact_id
            WHERE bc.broadcast_id = ${broadcastId}
                AND bc.contact_id > ${conId}
                AND bc.status = 'RUNNING'
                AND c.status = 'ACTIVE'
            ORDER BY bc.contact_id ASC
            LIMIT ${limit};
            `;
            return broadcastContacts;
        } catch (error) {
            this.logger.error(error);
            return [];
        }
    }

    /**
     * @Update broadcast contact
     * @param broadcastId 
     * @param contactId 
     * @param data 
     * @returns 
     */
    async updateByBroadcastAndContact(broadcastId: bigint, contactId: bigint, data: any): Promise<boolean> {
        if (broadcastId == null || contactId == null || data == null) {
            return false;
        }
        try {
            const updateBroadcastContact = await this.prisma.broadcastContact.updateMany({
                where: {
                    broadcastId: broadcastId,
                    contactId: contactId
                },
                data: {
                    ...data,
                    updatedAt: new Date()
                }
            })
            return updateBroadcastContact.count > 0;
        } catch (error) {
            this.logger.error(error);
        }
        return false;
    }


    /**
     * 
     * @param broadcastId 
     * @param contactId 
     * @returns 
     */
    async findBroadcastContact(broadcastId: bigint, contactId: bigint) {

        try {
            const broadcastContact = await this.prisma.broadcastContact.findFirst({
                where: {
                    broadcastId: broadcastId,
                    contactId: contactId
                }
            })
            return broadcastContact || null;
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * findContactById
     */
    async findContactById(contactId: bigint) {
        return await this.prisma.contact.findUnique({
            where: {
                id: contactId
            },
            select: {
                id: true,
                number: true,
                firstName: true,
                lastName: true,
            }
        })
    }
}