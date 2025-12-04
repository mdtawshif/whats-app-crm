import { ConversationMessageType, MessagingProduct, QueueStatus } from "@prisma/client"
import { DateTime } from "luxon"

export class BroadcastMessageQueueDTO{
    agencyId: bigint
    userId: bigint
    contactId: bigint
    broadcastId: bigint
    broadcastSettingId: bigint
    waBusinessNumberId: bigint
    status: QueueStatus
    sentAt: DateTime
    failedReason: string
    response: string
    messageType: ConversationMessageType
    messagingProduct: MessagingProduct
}

