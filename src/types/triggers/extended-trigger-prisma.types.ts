import type { CacheTriggerEventActionQueue } from "@prisma/client"
import type { TRIGGER_EVENT_CONTACT_ACTIONS } from "src/modules/trigger/constants/trigger.constant"

export interface CacheTriggerEventActionQueueWithPayload extends CacheTriggerEventActionQueue {
    payload: {
        contact?: {
            displayName: string,
            number: string
        },
        action?: typeof TRIGGER_EVENT_CONTACT_ACTIONS[keyof typeof TRIGGER_EVENT_CONTACT_ACTIONS]
        updatedFields?: string[]
        //for contact tag
        tagId?: string
        //for keyword
        message?: string
        //for broadcast
        broadcastId?: string
    }

}