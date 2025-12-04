import { validateAndFormatPhoneNumber } from '@/utils/phone-numbers/phone-utils';
import { Inject, Injectable } from '@nestjs/common'
import { Contact, ContactImportQueue, ContactImportQueueLogStatus } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { ContactUploadHelperService } from './contact.upload.helper.service';
import { BasicUser } from 'src/modules/user/dto/user.dto';
import { ContactTagService } from './contact.upload.tag.service';
import { ContactUploadCustomFieldService } from './contact.upload.customfield.service';

/**
 * @Milton463
 * @Note: this can be enable for workerThread to follow producer consumer pattern you can user bullMq
 *  
 */
@Injectable()
export class ContactUploadProcessWorker {

    constructor(
      private readonly prisma: PrismaService,
      private readonly logger: PinoLogger,
      private readonly contactUploadHelperService: ContactUploadHelperService,
      private readonly contactTagService: ContactTagService,
      private readonly contactUploadCustomFieldService: ContactUploadCustomFieldService
    ){}
  
    async processContacts(contactImportQueue: ContactImportQueue, contactData: any[],  headers: string[], fieldMappings: any, user: BasicUser, sourceId: bigint) {

      console.log(`contactData: ${JSON.stringify(contactData)}`);
      console.log(`contactData size: ${contactData.length}`);
      
      console.log('headers:', headers);
      const transformedContacts: any[] = [];
      
      for (const contact of contactData) {
        const transformedContact: any = await this.mapContactFields(contact, fieldMappings);
        if(Object.keys(transformedContact).length > 0) {
          transformedContact.country = contactImportQueue.country || 'US';
          transformedContact.countryCode = contactImportQueue.countryCode || '1';
          await this.mapCustomFields(contact, transformedContact, fieldMappings);
          await this.mapTagFields(contact, transformedContact, fieldMappings);
          transformedContacts.push(transformedContact);
        }
      }
      console.log(`transformedContacts: ${JSON.stringify(transformedContacts)}`);

      /**
       * @process contact import
       */
      await this.importContact(contactImportQueue, transformedContacts, user, sourceId, fieldMappings);
  }
  
  
  /**
   * @Method to import contacts
   * @param contactImportQueue 
   * @param transformedContacts 
   * @param user 
   * @param sourceId 
   * @param fieldMappings 
   */
  private async importContact(contactImportQueue: ContactImportQueue, transformedContacts:any[], user:BasicUser, sourceId: bigint, fieldMappings:any){

    for(let tcontact of transformedContacts){
        const validContactNumber = await this.checkValidContactNumber(contactImportQueue, tcontact);
        if(!validContactNumber || !validContactNumber.formattedNumber){
          await this.contactUploadHelperService.addImportContactQueueLog(user, tcontact, contactImportQueue, ContactImportQueueLogStatus.INVALID);
          continue;
        }

        const formattedNumber = validContactNumber.formattedNumber;
        tcontact.number = formattedNumber;
        const existingContact:any =  await this.findExistingContact(contactImportQueue.agencyId, formattedNumber);
        if(existingContact){
          const contact = existingContact as Contact;
          console.log("existingContact.....", existingContact.id);
          tcontact.id = contact.id;
          await this.contactUploadHelperService.processExistingContact(user, contactImportQueue, contact, tcontact, fieldMappings)
        }else{
          const contactId: bigint = await this.contactUploadHelperService.buildContactAndAddContact(user, tcontact, contactImportQueue, sourceId);
          tcontact.id = contactId
          contactId && await this.contactUploadHelperService.addImportContactQueueLog(user, tcontact, contactImportQueue, ContactImportQueueLogStatus.CREATED);
        }

        /**
         * @process contact tag here
         */
        await this.contactTagService.processContactTags(user, tcontact);
        
        /**
         *  @Process contact customFields here
         */
        await this.contactUploadCustomFieldService.assignCustomFields(user, tcontact);
    }
    
  }

  private async checkValidContactNumber(contactImportQueue: ContactImportQueue, transformedContact: any):Promise<{success: boolean, formattedNumber: string}>{
    if(!transformedContact.number){
      return {
        success:false,
        formattedNumber: ''
      }
    }

    const result = validateAndFormatPhoneNumber(transformedContact.number, contactImportQueue.country || 'US');
    if(!result.success){
      return {
        success:false,
        formattedNumber: ''
      }
    }
    
    return {
        success:true,
        formattedNumber: result.formattedNumber
    }
  }

  private async findExistingContact(agencyId: bigint, number: string){
    try{
      return await this.prisma.contact.findFirst({
        where:{
          agencyId: agencyId,
          number: number
        }
      });
    }catch(error){
      this.logger.error(error);
    }
    return null;
  }

  private async mapContactFields(contact: any, fieldMappings: any): Promise<any> {
    const transformedContact: any = {
      customFields: [],
      tags: []
    };
    for (const mapping of fieldMappings.contactMappings) {
        const { csvField, contactField, isRequired } = mapping;
        const value = contact[csvField];
          if (isRequired && (value === undefined || value === null || value === '')) {
              continue;
          }
          transformedContact[contactField] = value || null;
        }
      
    return transformedContact;
  }

  private async mapCustomFields(contact: any, transformedContact: any, fieldMappings: any): Promise<any> {
      const customFieldIds : string[] = [];
      for (const mapping of fieldMappings.customFieldMappings) {
        const { csvField, contactField, customFieldId, isRequired } = mapping;
        if(customFieldId){
          customFieldIds.push(customFieldId);
        }
    }
    console.log("customFieldIds: ", customFieldIds);
    transformedContact.customFields = customFieldIds;
  }

  private async mapTagFields(contact: any, transformedContact: any, fieldMappings: any): Promise<any> {
      let tags: string[] = [];
      for (const mapping of fieldMappings.tagMappings) {
        const { csvField, isRequired } = mapping;
        const tag = contact[csvField];
        if (isRequired && (tag === undefined || tag === null || tag === '')) {
          continue;
        }
        tags.push(tag);
    }
    transformedContact.tags = tags;
  }

}
