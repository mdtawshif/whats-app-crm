import { TemplateCategory } from "@prisma/client"
import { from } from "form-data"


/**
 * @Milton463
 */

export enum GatewayType {
    TWILIO,
    DIALOG360
}

export interface GatewayAuth {
    authKey: string
    authToken: string,
    gateway: GatewayType
}

export interface TwilioWAMessageRequest { 
    fromNumber?: string
    toNumber?: string
    contentSid?: string
    contentVariables?: string
    messageBody?: string
    gatewayAuth?: GatewayAuth,
    isTemplateMessage?: boolean,
    messageTemplateCategory?: TemplateCategory
}