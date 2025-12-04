import { BroadcastContactSource, BroadcastContactStatus } from "@prisma/client"


export class BroadcastContactDTO{
    agencyId: bigint
    teamId: bigint
    userId: bigint
    contactId: bigint
    broadcastId: bigint
    contactSource: BroadcastContactSource
    entryDate: Date
    status: BroadcastContactStatus
    lastMessageAt: Date
    nextAllowedMessageAt: Date
}