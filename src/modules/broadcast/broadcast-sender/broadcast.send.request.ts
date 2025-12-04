import { Broadcast, BroadcastMessageQueue, BroadcastSetting, Contact, FbBusinessAccount, MessageTemplate, User, WaBusinessAccount, WaBusinessNumber } from "@prisma/client"
import { TwilioWAMessageRequest } from "src/modules/gateway-provider/twilio.wa.msg.request"


export class BroadcastSendRequest {
    success: boolean
    errorMessage?: string
    user?: User
    broadcast?: Broadcast
    broadcastSetting?: BroadcastSetting
    contact?: Contact
    broadcastMessageQueue?: BroadcastMessageQueue
    twilioWAMessageRequest?:TwilioWAMessageRequest
    waBusinessAccount?: WaBusinessAccount
    fbBusinessAccount?: FbBusinessAccount
    waBusinessNumber?: WaBusinessNumber
    messageTemplate?: MessageTemplate
}