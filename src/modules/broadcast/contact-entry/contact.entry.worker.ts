import { Injectable } from '@nestjs/common'
import { PrismaService } from 'nestjs-prisma'
import {
  BroadcastContactEntryQueue,
  BroadcastContactQueueSource,
  BroadcastContactSource,
  BroadcastContactStatus,
  EntryStatus,
  UserStatus
} from '@prisma/client'
import { BroadcastContactRepository } from '../repository/broadcast.contact.repository'
import { SegmentContactRepository } from 'src/modules/segment/segment.contact.repository'
import { BroadcastContactDTO } from '../dto/broadcastContactDTO'
import { ContactTagService } from 'src/modules/tag/contact.tag.service'
import { ContactImportQueueContactRepository } from 'src/modules/contacts/contact.import.queue.contact.repository'
import { ContactEntryAddHelper } from './contact.entry.add.helper'
import { ContactEntryHelperService } from './contact.entry.helper.service'
import { BroadcastHelperService } from '../broadcast.helper.service'
import { BroadcastProcessRequest } from '../broadcast.requset'
import { BroadcastContactEntryQueueDTO } from '../dto/broadcast.contact.entry.queue.dto'


/**
 * @author @Milton
 */
@Injectable()
export class ContactEntryWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactEntryAddHelper: ContactEntryAddHelper,
    private readonly contactEntryHelperService: ContactEntryHelperService,
    private readonly broadcastHelperService: BroadcastHelperService,
    private readonly contactEntyHelperService: ContactEntryHelperService,
  
  ) { }

  async processContactEntry(entry: BroadcastContactEntryQueue): Promise<void> {
    const contactSource = entry.contactSource
    console.info("contactSource:", contactSource);
    
    let broadcastProcessRequest = {
        success:true,
        broadcastSettingDTO:null,
        broadcast:null,
        broadcastContact: null,
        broadcastId: null,
        user: null
      }

    const isAbleToAddContact = await this.isAbleToAddContact(entry, broadcastProcessRequest);
    if(!isAbleToAddContact){
      const queueIds = [entry.id];
      await this.updateStatus(queueIds, broadcastProcessRequest);
      return;
    }

    switch (contactSource) {
      case BroadcastContactQueueSource.CONTACT: {
        await this.contactEntryAddHelper.addContactToBroadcast(entry, broadcastProcessRequest);
        break
      }
      case BroadcastContactQueueSource.FILE: {
        await this.addFileContacts(entry);
        break
      }
      case BroadcastContactQueueSource.TAG: {
        await this.addTagContacts(entry);
        break
      }
      case BroadcastContactQueueSource.SEGMENT: {
        await this.addSegmentContacts(entry);
        break
      }
      case BroadcastContactQueueSource.GOOGLE_CONTACT: {
        await this.addSegmentContacts(entry);
        break
      }
    }

    const queueIds = [entry.id];
    await this.updateStatus(queueIds, broadcastProcessRequest);
  }

  async updateStatus(ids:bigint[], broadcastProcessRequest: BroadcastProcessRequest){
    const data: any = {
          status: broadcastProcessRequest.success ? EntryStatus.COMPLETED : EntryStatus.FAILED,
          failedReason: broadcastProcessRequest.success ? '' : broadcastProcessRequest.errorMessage
    }
    await this.contactEntyHelperService.updateContactEntryQueueRequest(ids, data);
  }
  
   /**
     * @Check either contact is able to add to broacast
     * @param broadcastContactEntryRequest 
     * @param broadcastProcessRequest 
     * @returns 
     */
    private async isAbleToAddContact(broadcastContactEntryRequest: BroadcastContactEntryQueue, broadcastProcessRequest: BroadcastProcessRequest){
        
        const user = await this.broadcastHelperService.findUserById(broadcastContactEntryRequest.userId);
        if(!user || user.status!=UserStatus.ACTIVE){
            broadcastProcessRequest.success = false,
            broadcastProcessRequest.errorMessage ='User either does not exist or is not active'
            return false;
        }
        broadcastProcessRequest.user = user;
        
        const broadcast = await this.broadcastHelperService.findBroadcastById(broadcastContactEntryRequest.broadcastId);
        if(broadcast == null){
            broadcastProcessRequest.success = false;
            broadcastProcessRequest.errorMessage = `No broadcast: ${broadcastContactEntryRequest.broadcastId} found to add contact: ${broadcastContactEntryRequest.contactId}`;
            return false;
        }
        if(broadcast.timeZone == null){
            broadcast.timeZone = user.timeZone;
        }
        broadcastProcessRequest.broadcast = broadcast;
        return true;
    }


  /**
   *  Add segment contacts
   */
  private async addSegmentContacts(broadcastContactEntryQueue: BroadcastContactEntryQueue) {
    console.log("processing segment contacts...........................")
    let batchSize = 100;
    let hasSegmentContact = true;
    let contactId: bigint = 0n;

    while (hasSegmentContact) {
      const segmentContacts = await this.contactEntryHelperService.findActiveContactBySegmentId(broadcastContactEntryQueue, contactId, batchSize);
      if (!segmentContacts || segmentContacts.length === 0) {
        hasSegmentContact = false;
        break;
      }
      contactId = segmentContacts[segmentContacts.length - 1].contactId;

      const broadcastContactEntryQueueDTO: BroadcastContactEntryQueueDTO[] = segmentContacts.map(segmentContact => {
        return this.buildBroadcastContactEntryQueue(broadcastContactEntryQueue, segmentContact.contactId);
      });
      await this.contactEntryHelperService.addBroadcastContactQueueEntryInBatch(broadcastContactEntryQueueDTO);
    }
  }

  /**
   *  Add tag contacts
   */
  private async addTagContacts(broadcastContactEntryQueue: BroadcastContactEntryQueue) {

    let batchSize = 100;
    let contactId: bigint = 0n;
    let hastTagContacts = true;

    while (hastTagContacts) {

      const tagContacts = await this.contactEntryHelperService.findActiveTagContacts(broadcastContactEntryQueue, contactId, batchSize);
      if (!tagContacts || tagContacts.length === 0) {
        hastTagContacts = false;
        break;
      }
      contactId = tagContacts[tagContacts.length - 1].contactId;

      const broadcastContactEntryQueueDTO: BroadcastContactEntryQueueDTO[] = tagContacts.map(tagContact => {
        return this.buildBroadcastContactEntryQueue(broadcastContactEntryQueue, tagContact.contactId);
      });
      const totalInserted = await this.contactEntryHelperService.addBroadcastContactQueueEntryInBatch(broadcastContactEntryQueueDTO);
      console.log("totalInserted: ", totalInserted);
    }
  }

  /**
   *  Add file [csv/google-sheet] contacts
   */
  private async addFileContacts(broadcastContactEntryQueue: BroadcastContactEntryQueue) {
    let batchSize = 100;
    let contactId: bigint = 0n;
    let hasFileContacts = true;

    while (hasFileContacts) {

      const filecontacts = await this.contactEntryHelperService.findActiveImportedContacts(broadcastContactEntryQueue, contactId, batchSize);

      if (!filecontacts || filecontacts.length === 0) {
        hasFileContacts = false;
        break;
      }
      contactId = filecontacts[filecontacts.length - 1].contactId;

      const broadcastContactEntryQueueDTO: BroadcastContactEntryQueueDTO[] = filecontacts.map(fileContact => {
        return this.buildBroadcastContactEntryQueue(broadcastContactEntryQueue, fileContact.contactId);
      });
      await this.contactEntryHelperService.addBroadcastContactQueueEntryInBatch(broadcastContactEntryQueueDTO);
    }

  }

  /**
   *  Add Goolge imported contacts
   */
  private async addGoogleImportedContacts(broadcastContactEntryQueue: BroadcastContactEntryQueue) {
    let batchSize = 100;
    let hasSegmentContact = true;
    let contactId: bigint = 0n;

    while (hasSegmentContact) {
      const gmailImportedContacts = await this.contactEntryHelperService.findActiveGmailImportedContacts(broadcastContactEntryQueue, contactId, batchSize);

      if (!gmailImportedContacts || gmailImportedContacts.length === 0) {
        hasSegmentContact = false;
        break;
      }
      contactId = gmailImportedContacts[gmailImportedContacts.length - 1].contactId;

      const broadcastContactEntryQueueDTO: BroadcastContactEntryQueueDTO[] = gmailImportedContacts.map(segmentContact => {
        return this.buildBroadcastContactEntryQueue(broadcastContactEntryQueue, segmentContact.contactId);
      });
     
      await this.contactEntryHelperService.addBroadcastContactQueueEntryInBatch(broadcastContactEntryQueueDTO);
    
    }
  }

  private buildBroadcastContactEntryQueue(broadcastContactEntryQueue: BroadcastContactEntryQueue, contactId: bigint) {
    const broadcastContactEntryQueueDTO = {
      agencyId: broadcastContactEntryQueue.agencyId,
      createdBy: broadcastContactEntryQueue.userId,
      userId: broadcastContactEntryQueue.userId,
      broadcastId: broadcastContactEntryQueue.broadcastId,
      contactId: contactId,
      sourceId: broadcastContactEntryQueue.sourceId,
      contactSource: BroadcastContactQueueSource.CONTACT,
      status: EntryStatus.PENDING
    }
    return broadcastContactEntryQueueDTO
  }

}
