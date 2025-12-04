import { Injectable } from '@nestjs/common'
import { PrismaService } from 'nestjs-prisma'
import { BroadcastContactEntryService } from '../service/broadcast.contact.entry.service'
import { PinoLogger } from 'nestjs-pino'
import { ConcurrencyLimiter } from '../concurrency.limiter'
import { ContactEntryWorker } from './contact.entry.worker'
import { BroadcastContactEntryQueue, EntryStatus } from '@prisma/client'

@Injectable()
export class ContactEntryQueueProcessor {
  private readonly BATCH_SIZE = 100

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
    private readonly concurrencyLimiter: ConcurrencyLimiter,
    private readonly contactEntryWorker: ContactEntryWorker
  ) {}

  async processBroadcastContactEntry(): Promise<void> {
    console.log("processing BroadcastContactEntryQueueRequests.....")
    let hasNextRequest = true
    let id: bigint = 0n
    while (hasNextRequest) {
      const contactEntryRequests = await this.findPendingEntries(this.BATCH_SIZE, id);
      if (!contactEntryRequests || contactEntryRequests.length === 0) {
        hasNextRequest = false
        break
      }
      console.info("totalQueueRequeusts:", contactEntryRequests.length);

      id = contactEntryRequests[contactEntryRequests.length - 1]?.id
      await this.process(contactEntryRequests)
    }
  }

  private async process(entris: BroadcastContactEntryQueue[]): Promise<void> {

    await this.updateStatus( entris.map((e) => e.id), EntryStatus.PROCESSING);

    entris.map((entry) => {
      this.concurrencyLimiter.run(() =>
        this.contactEntryWorker.processContactEntry(entry)
      )
    })
  }

  async findPendingEntries(batchSize: number, id?: bigint): Promise<BroadcastContactEntryQueue[]> {
    return await this.prisma.broadcastContactEntryQueue.findMany({
      where: {
        status: EntryStatus.PENDING,
        id: {
          gt: id
        }
      },
      orderBy: {
        id: 'asc'
      },
      take: batchSize
    })
  }

  async updateStatus(ids: bigint[], status: EntryStatus): Promise<void> {
    await this.prisma.broadcastContactEntryQueue.updateMany({
      where: { id: { in: ids } },
      data: { status: status, processedAt: new Date() }
    })
  }
}
