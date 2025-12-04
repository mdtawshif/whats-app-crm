import { PinoLogger } from "nestjs-pino";
import { BroadcastContactEntryQueueRepository } from "../repository/broadcast.contact.entry.queue.repository";
import { Injectable } from "@nestjs/common";
import { BroadcastContactEntryQueue } from "@prisma/client";
import { BroadcastContactDTO } from "../dto/broadcastContactDTO";
import { BroadcastContactRepository } from "../repository/broadcast.contact.repository";
import { ContactImportQueueContactRepository } from "src/modules/contacts/contact.import.queue.contact.repository";
import { SegmentContactRepository } from "src/modules/segment/segment.contact.repository";
import { ContactTagService } from "src/modules/tag/contact.tag.service";
import { BroadcastContactEntryQueueDTO } from "../dto/broadcast.contact.entry.queue.dto";
import { GmailImportedContactRepository } from "../repository/gmail.imported.contact.repository";

/**
 * @author @Milton
 */
@Injectable()
export class ContactEntryHelperService {
  constructor(
    private readonly broadcastContactEntryQueueRepository: BroadcastContactEntryQueueRepository,
    private readonly logger: PinoLogger,
    private readonly broadcastContactRepository: BroadcastContactRepository,
    private readonly contactImportQueueContactRepository: ContactImportQueueContactRepository,
    private readonly segmentContactRepository: SegmentContactRepository,
    private readonly contactTagService: ContactTagService,
    private readonly gmailImportedContactRepository: GmailImportedContactRepository,
  ) {
    this.logger.setContext(ContactEntryHelperService.name)
  }

  async findPendingContactEntryQueueRequests(id: bigint, batchSize: number): Promise<BroadcastContactEntryQueue[]>{
    return await this.broadcastContactEntryQueueRepository.findPendingEntries(id, batchSize);
  }

  async updateContactEntryQueueRequest(ids: bigint[], data:any){
    await this.broadcastContactEntryQueueRepository.updateByIds(ids, data);
  }

  async addBroadcastContact(broadcastContactDTO: BroadcastContactDTO){
     return await this.broadcastContactRepository.addBroadcastContact(broadcastContactDTO)
  }

  async findActiveContactBySegmentId(broadcastContactEntryQueue: BroadcastContactEntryQueue, contactId: bigint, batchSize: number){
    return await this.segmentContactRepository.findActiveContactBySegmentId(broadcastContactEntryQueue.userId, broadcastContactEntryQueue.sourceId, contactId, batchSize)
  }

  async findActiveTagContacts(broadcastContactEntryQueue: BroadcastContactEntryQueue, contactId: bigint, batchSize:number){
    return await this.contactTagService.findActiveTagContacts(broadcastContactEntryQueue.userId, broadcastContactEntryQueue.sourceId, contactId, batchSize);
  }

  async findActiveImportedContacts(broadcastContactEntryQueue: BroadcastContactEntryQueue, contactId: bigint, batchSize:number){
    return await this.contactImportQueueContactRepository.findActiveImportedContacts(broadcastContactEntryQueue.userId, broadcastContactEntryQueue.sourceId, contactId, batchSize);
  }

  async addBroadcastContactQueueEntryInBatch(broadcastContactEntryQueues: BroadcastContactEntryQueueDTO[]){
    await this.broadcastContactEntryQueueRepository.addBroadcastContactEntryQueueInBatch(broadcastContactEntryQueues);
  }

  async findActiveGmailImportedContacts(broadcastContactEntryQueue, conId: bigint, batchSize: number){
     return await this.gmailImportedContactRepository.findActiveContactByGmailAccountId(broadcastContactEntryQueue.userId, broadcastContactEntryQueue.sourceId, conId, batchSize);
  }

}