import { BroadcastContactQueueSource, EntryStatus } from "@prisma/client"

export class BroadcastContactEntryQueueDTO {
    agencyId: bigint
    userId: bigint
    createdBy?:bigint
    contactId: bigint
    broadcastId: bigint
    sourceId: bigint
    contactSource: BroadcastContactQueueSource
    status: EntryStatus
}