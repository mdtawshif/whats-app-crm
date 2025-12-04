// src/types/triggers.ts

import type {
    Trigger,
    TriggerActionConfig,
    TriggerEventConfig
} from '@prisma/client'

// Updated Filter type to support readonly options for 'as const' compatibility
export type Filter<T = string> = {
    title: string
    key: string
    field: string
    operator: string
    valueType: string
    value?: string
    options?: readonly T[] // Changed to readonly for type safety with 'as const'
    min?: number
    max?: number
    required: boolean
    description: string
    multiple?: boolean
}

// Updated ConfigField type to support readonly options
export type ConfigField<T = string> = {
    key: string
    title: string
    type: string
    options?: readonly T[] // Changed to readonly for type safety with 'as const'
    required: boolean
    description: string
    dynamicOptions?: boolean
    multiple?: boolean
}

export type TriggerEvent = {
    key: string // Use EventKeys enum if defined
    title: string
    description: string
    allowedActions: string[] // Or ActionKeys[]
    metadata: {
        radioGroups?: object[]
        hasRadioGroup?: boolean
        groupTitles?: string[]
        requiredFilters?: string[]

        availableFilters: Filter[]
    }
}

export type Action = {
    key: string // Use ActionKeys enum if defined
    title: string
    description: string
    metadata: {
        radioGroups?: object[]
        hasRadioGroup?: boolean
        groupTitles?: string[]
        configFields: ConfigField[],
        // NEW: Add event-specific overrides
        eventOverrides?: Partial<
            Record<
                EventKeys,
                {
                    configFields: ConfigField[]
                    radioGroups?: object[]
                    groupTitles?: string[]
                }
            >
        >
    }

}

// Assuming EventKeys and ActionKeys are enums
export enum EventKeys {
    BIRTHDAY = 'BIRTHDAY',
    ANNIVERSARY = 'ANNIVERSARY',
    CONTACT_ADDED = 'CONTACT_ADDED',
    CONTACT_ADDED_TO_BROADCAST = 'CONTACT_ADDED_TO_BROADCAST',
    KEYWORD = 'KEYWORD',
    CONTACT_TAG = 'CONTACT_TAG',
    // Add more as needed
}
// export const TRIGGER_EVENTS = EventKeys

export type TriggerEventType = keyof typeof EventKeys

export enum ActionKeys {
    SEND_WHATSAPP_MESSAGE = 'SEND_WHATSAPP_MESSAGE',
    // REPLY_WITH_ORDER_STATUS = 'REPLY_WITH_ORDER_STATUS',
    // SYNC_TO_INTEGRATION = 'SYNC_TO_INTEGRATION',
    // ADD_CONTACT_TO_CRM = 'ADD_CONTACT_TO_CRM',
    ADD_TAG_TO_CONTACT = 'ADD_TAG_TO_CONTACT',
    UNSUBSCRIBE_BROADCAST = 'UNSUBSCRIBE_BROADCAST',
    PAUSE_BROADCAST = 'PAUSE_BROADCAST',
    UNSUBSCRIBE_FROM_ALL_BROADCAST = 'UNSUBSCRIBE_FROM_ALL_BROADCAST',
    PAUSE_FROM_ALL_BROADCAST = 'PAUSE_FROM_ALL_BROADCAST',
    OPTOUT_CONTACT = 'OPTOUT_CONTACT',
    ADD_CONTACT_TO_BROADCAST = 'ADD_CONTACT_TO_BROADCAST'
    // Add more as needed
}
// export const TRIGGER_ACTIONS = ActionKeys
export type TriggerActionType = keyof typeof ActionKeys

// allowedEvents map (assuming this is defined here or imported)
// Fill this based on your original logic; I stubbed examples
export const allowedEvents: Record<EventKeys, ActionKeys[]> = {
    [EventKeys.BIRTHDAY]: [
        ActionKeys.SEND_WHATSAPP_MESSAGE,
        ActionKeys.ADD_TAG_TO_CONTACT
    ],
    [EventKeys.ANNIVERSARY]: [
        ActionKeys.SEND_WHATSAPP_MESSAGE,
        ActionKeys.ADD_TAG_TO_CONTACT
    ],
    [EventKeys.CONTACT_ADDED]: [
        ActionKeys.SEND_WHATSAPP_MESSAGE,
        ActionKeys.ADD_TAG_TO_CONTACT
    ],
    [EventKeys.KEYWORD]: [
        ActionKeys.SEND_WHATSAPP_MESSAGE,
        ActionKeys.ADD_TAG_TO_CONTACT,
        ActionKeys.OPTOUT_CONTACT,
        ActionKeys.UNSUBSCRIBE_BROADCAST,
        ActionKeys.PAUSE_BROADCAST,
        ActionKeys.OPTOUT_CONTACT,
        ActionKeys.UNSUBSCRIBE_FROM_ALL_BROADCAST,
        ActionKeys.PAUSE_FROM_ALL_BROADCAST,
        ActionKeys.ADD_CONTACT_TO_BROADCAST
    ],
    [EventKeys.CONTACT_TAG]: [
        ActionKeys.SEND_WHATSAPP_MESSAGE,
        ActionKeys.OPTOUT_CONTACT,
        ActionKeys.UNSUBSCRIBE_BROADCAST,
        ActionKeys.PAUSE_BROADCAST,
        ActionKeys.UNSUBSCRIBE_FROM_ALL_BROADCAST,
        ActionKeys.PAUSE_FROM_ALL_BROADCAST,
        ActionKeys.ADD_CONTACT_TO_BROADCAST
    ],
    [EventKeys.CONTACT_ADDED_TO_BROADCAST]: [
        ActionKeys.ADD_TAG_TO_CONTACT,
        ActionKeys.SEND_WHATSAPP_MESSAGE,
        ActionKeys.ADD_CONTACT_TO_BROADCAST,
    ]
    // Adjust as per your allowedEvents
}

export const defineTriggerEvent = (event: TriggerEvent): TriggerEvent => event // Factory if needed

// Event handler base interface
interface BaseEventHandler {
    process(context: any): Promise<boolean>
}

// Specific event handler types (implement BaseEventHandler)
interface BirthdayEventHandler extends BaseEventHandler { }
interface AnniversaryEventHandler extends BaseEventHandler { }
interface NewLeadEventHandler extends BaseEventHandler { }
interface DateBasedEventHandler extends BaseEventHandler { }
interface KeywordEventHandler extends BaseEventHandler { }
interface ContactAddedUpdatedEventHandler extends BaseEventHandler { }
interface ExternalWebhookEventHandler extends BaseEventHandler { }

// Union type for all event handlers
type EventHandler =
    | BirthdayEventHandler
    | AnniversaryEventHandler
    | NewLeadEventHandler
    | DateBasedEventHandler
    | KeywordEventHandler
    | ContactAddedUpdatedEventHandler
    | ExternalWebhookEventHandler

// Fully typed TriggerResources interface
export interface TriggerResources {
    trigger: Trigger
    eventConfig: TriggerEventConfig & {
        TriggerActionConfig: (TriggerActionConfig & { triggerAction: Action })[]
    }

    eventHandler: EventHandler
    allowedActions: ActionKeys[] // Add allowedActions
}


