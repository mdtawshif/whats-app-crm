import { BroadcastType } from "@prisma/client"

export class BroadcastSettingDTO {
    id: bigint
    broadcastType: BroadcastType
    day: number
    priority: number
    time: String
    waBusinessNumberId: bigint
    messageTemplateId: bigint
}