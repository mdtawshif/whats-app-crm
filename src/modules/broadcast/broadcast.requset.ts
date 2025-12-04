import { Broadcast, BroadcastContact, BroadcastSetting, Contact, ContactAction, ConversationMessageType, FbBusinessAccount, MessagingProduct, User, WaBusinessAccount, WaBusinessNumber } from "@prisma/client"
import { BroadcastSettingDTO } from "./dto/broadcast.setting.dto"


export interface BroadcastProcessRequest {
    success: boolean,
    errorMessage?: string
    broadcastSettingDTO: BroadcastSettingDTO
    broadcastId: bigint
    broadcastContact: BroadcastContact
    broadcast: Broadcast,
    user: User
}

export interface BroadcastContactProcessResponse {
    success: boolean,
    errorMessage?: string,
    message?: string,
    action?: ContactAction
}
