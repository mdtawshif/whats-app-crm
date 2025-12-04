import { Injectable } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { BasicUser } from "src/modules/user/dto/user.dto";

/**
 * @Milton463
 */
@Injectable()
export class ContactTagService {

    constructor(
        private readonly prisma: PrismaService
    ){}

    async processContactTags(user: BasicUser, contact: any){
        
        const tags = Array.isArray(contact?.tags) ? contact.tags : [];
        if (tags.length === 0) {
            console.log(`No tags found for contactId ${contact.id}`);
            return;
        }
        for(const tag of tags){
            const existingTag = await this.findOrCreateTag(user, tag);
            if(!existingTag){
                continue;
            }
            await this.assignTagToContact(user, contact.id, existingTag.id);
        }
    }

    private async findOrCreateTag(user: BasicUser, tag: string) {
        let existingTag = await this.prisma.tag.findFirst({
            where: {
            userId: user.parentUserId ?? user.id,
            title: tag
            },
        });
        if (!existingTag) {
            existingTag = await this.prisma.tag.create({
            data: {
                userId: user.parentUserId ?? user.id,
                agencyId: user.agencyId,
                createdBy: user.id,
                title: tag,
                description: `${tag} created from file`,
            },
            });
        }
        return existingTag;
    }

   private async assignTagToContact(user: BasicUser, contactId: bigint, tagId: bigint) {
    await this.prisma.contactTag.createMany({
            data: [{
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            createdBy: user.id,
            contactId,
            tagId,
            }],
            skipDuplicates: true,
        });
        console.log(`Tag (${tagId}) assigned to contact (${contactId})`);
    }

}