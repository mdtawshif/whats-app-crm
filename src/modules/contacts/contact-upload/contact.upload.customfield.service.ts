import { Injectable } from '@nestjs/common'
import { PrismaService } from 'nestjs-prisma'
import { BasicUser } from 'src/modules/user/dto/user.dto'

/**
 * @Milton463
 */
@Injectable()
export class ContactUploadCustomFieldService {
  constructor(private readonly prisma: PrismaService) {}

  async assignCustomFields(user: BasicUser, contact: any) {

    const customFieldIds = Array.isArray(contact?.customFields) ? contact.customFields : [];
      if (customFieldIds.length === 0) {
        console.log(`No customFields found for contactId ${contact.id}`);
        return;
    }

    for(const customFieldId of customFieldIds){
        const customField = await this.prisma.customField.findFirst({where:{id:customFieldId}});
        if(!customField){
         continue;
       }
      await this.addContactCustomField(user, contact, customFieldId, customField.defaultValue);
    }
  }

  async addContactCustomField(user: BasicUser, contact:any, customFieldId:any, value:string){
    const data = {
        userId: user.parentUserId ?? user.id,
        agencyId: user.agencyId,
        createdBy: user.id,
        contactId: contact.id,
        customFieldId: customFieldId,
        value: value
    }
    const contactCustomField = await this.prisma.contactCustomField.createMany({
        data:[data],  skipDuplicates: true,
    })
  }

}
