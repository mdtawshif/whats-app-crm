// src/constants/triggerConfig.ts

import { getTimeOptions } from '../../../utils/dateUtils'; // Ensure this util exists for time options
import {
    CONTACT_SOURCE_MANUAL,
    CONTACT_SOURCE_CSV,
    CONTACT_SOURCE_GOOGLE_CONTACTS,
    CONTACT_SOURCE_GOOGLE_SHEET,
} from '../../../utils/global-constant'; // Imported your constants for integration options

import {
    EventKeys,
    ActionKeys,
    Filter,
    allowedEvents,
    defineTriggerEvent,
    TriggerEvent,
    Action
} from '../../../types/triggers'; // Updated import

// --- Trigger Filters (unchanged, all configs preserved) ---

export const TRIGGER_FILTER_FIELDS = {
    MONTH: 'month',
    DAY: 'day',
    BEFORE_DAYS: 'before_days',
    AFTER_DAYS: 'after_days',
    ON_DAY: 'on_day',
    // TAG: 'tag',
    HAS_TAG: 'has_tag',
    DOESNT_HAVE_TAG: 'doesnt_have_tag',
    ACTION: 'action',
    UPDATED_FIELDS: 'updated_fields',
    KEYWORD: 'keyword',
    MATCH_CONDITION: 'matchCondition',
    TAG_ADDED: 'tag_added',
    TAG_REMOVED: 'tag_removed',
    BROADCAST_ID: 'broadcast_id',
} as const;

export const TRIGGER_FILTER_OPERATORS = {
    EQUALS: 'equals',
    NOT_EQUALS: 'not_equals',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'not_contains',
    GREATER_THAN: 'greater_than',
    LESS_THAN: 'less_than',
    BEFORE: 'before',
    AFTER: 'after',
    HAS: 'has',
    NOT_HAS: 'not_has',
    CUSTOM: 'custom',
} as const;

export const TRIGGER_FILTER_VALUE_TYPES = {
    SELECT: 'select',
    NUMBER: 'number',
    TEXT: 'text',
    SELECT_TAG: 'select_tag',
    SELECT_BROADCAST: 'select_broadcast',
} as const;

export const MATCH_CONDITION_OPTIONS = {
    STARTS_WITH: 'starts_with',
    ENDS_WITH: 'ends_with',
    CONTAINS: 'contains',
    EXACT: 'exact',
}
//trigger event action options
export const TRIGGER_EVENT_CONTACT_ACTIONS = {
    CREATED: "CREATED",
    UPDATED: "UPDATED"
}





export type TriggerFilterField = keyof typeof TRIGGER_FILTER_FIELDS;
export type TriggerFilterOperator = keyof typeof TRIGGER_FILTER_OPERATORS;
export type TriggerFilterValueType = keyof typeof TRIGGER_FILTER_VALUE_TYPES;

export const TriggerFilterFields = {
    [TRIGGER_FILTER_FIELDS.MONTH]: {
        title: 'Month',
        key: TRIGGER_FILTER_FIELDS.MONTH,
        field: TRIGGER_FILTER_FIELDS.MONTH,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT,
        options: [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ] as const,
        required: true,
        description: 'Select the month of the birthday or anniversary to trigger this event (e.g., January).',
    },
    [TRIGGER_FILTER_FIELDS.DAY]: {
        title: 'Day',
        key: TRIGGER_FILTER_FIELDS.DAY,
        field: TRIGGER_FILTER_FIELDS.DAY,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.NUMBER,
        min: 1,
        max: 31,
        required: false,
        description: 'Enter the day of the month (1-31) to trigger the event on a specific date.',
    },
    [TRIGGER_FILTER_FIELDS.BEFORE_DAYS]: {
        title: 'Days Before',
        key: TRIGGER_FILTER_FIELDS.BEFORE_DAYS,
        field: TRIGGER_FILTER_FIELDS.BEFORE_DAYS,
        operator: TRIGGER_FILTER_OPERATORS.BEFORE,
        valueType: TRIGGER_FILTER_VALUE_TYPES.NUMBER,
        min: 0,
        max: 365,
        required: false,
        description: 'Trigger the event a set number of days before the date (e.g., 7 for a week early).',
    },
    [TRIGGER_FILTER_FIELDS.AFTER_DAYS]: {
        title: 'Days After',
        key: TRIGGER_FILTER_FIELDS.AFTER_DAYS,
        field: TRIGGER_FILTER_FIELDS.AFTER_DAYS,
        operator: TRIGGER_FILTER_OPERATORS.AFTER,
        valueType: TRIGGER_FILTER_VALUE_TYPES.NUMBER,
        min: 0,
        max: 365,
        required: false,
        description: 'Trigger the event a set number of days after the date (e.g., 1 for the next day).',
    },
    [TRIGGER_FILTER_FIELDS.ON_DAY]: {
        title: 'On Day Time',
        key: TRIGGER_FILTER_FIELDS.ON_DAY,
        field: TRIGGER_FILTER_FIELDS.ON_DAY,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT,
        options: getTimeOptions(),
        required: false,
        description: 'Trigger the event on the exact date at a specific time (e.g., 9:00 AM).',
    },
    [TRIGGER_FILTER_FIELDS.HAS_TAG]: {
        title: 'Has Tag',
        key: TRIGGER_FILTER_FIELDS.HAS_TAG,
        field: 'tag',
        operator: TRIGGER_FILTER_OPERATORS.HAS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT_TAG,
        required: false,
        description: 'Target contacts with a specific tag (e.g., "VIP") for this event.',
    },
    [TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG]: {
        title: 'Does Not Have Tag',
        key: TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG,
        field: 'tag',
        operator: TRIGGER_FILTER_OPERATORS.NOT_HAS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT_TAG,
        required: false,
        description: 'Exclude contacts with specific tags (e.g., "inactive") from this event.',
    },
    [TRIGGER_FILTER_FIELDS.ACTION]: {
        title: 'Action Type',
        key: TRIGGER_FILTER_FIELDS.ACTION,
        field: TRIGGER_FILTER_FIELDS.ACTION,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT,
        options: [TRIGGER_EVENT_CONTACT_ACTIONS.CREATED] as const,
        required: true,
        description: 'Select whether to trigger when a contact is created or updated.',
    },
    [TRIGGER_FILTER_FIELDS.UPDATED_FIELDS]: {
        title: 'Updated Field',
        key: TRIGGER_FILTER_FIELDS.UPDATED_FIELDS,
        field: TRIGGER_FILTER_FIELDS.UPDATED_FIELDS,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT,
        multiple: true,
        options: [
            'firstName',
            'lastName',
            'email',
            'city',
            'state',
            'country',
            'address',
            'status',
            'birthDate',
            'anniversaryDate',
        ] as const,
        required: false,
        description: 'Choose specific fields (e.g., email or address) to trigger only when they are updated.',
    },
    [TRIGGER_FILTER_FIELDS.KEYWORD]: {
        title: 'Keyword or Phrase',
        key: TRIGGER_FILTER_FIELDS.KEYWORD,
        field: TRIGGER_FILTER_FIELDS.KEYWORD,
        operator: TRIGGER_FILTER_OPERATORS.CUSTOM,
        valueType: TRIGGER_FILTER_VALUE_TYPES.TEXT,
        required: true,
        description: 'Enter the keyword or phrase to detect in incoming messages.',
    },
    [TRIGGER_FILTER_FIELDS.MATCH_CONDITION]: {
        title: 'Match Condition',
        key: TRIGGER_FILTER_FIELDS.MATCH_CONDITION,
        field: TRIGGER_FILTER_FIELDS.MATCH_CONDITION,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT,
        options: [MATCH_CONDITION_OPTIONS.EXACT, MATCH_CONDITION_OPTIONS.CONTAINS, MATCH_CONDITION_OPTIONS.STARTS_WITH, MATCH_CONDITION_OPTIONS.ENDS_WITH] as const,
        required: true,
        description: 'Choose how the keyword should match the message (e.g., exact match or contains).',
    },
    // NEW: Add these right after the DOESNT_HAVE_TAG one, for logical grouping with tags
    [TRIGGER_FILTER_FIELDS.TAG_ADDED]: {
        title: 'Tag Added',
        key: TRIGGER_FILTER_FIELDS.TAG_ADDED,
        field: TRIGGER_FILTER_FIELDS.TAG_ADDED,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT_TAG,
        multiple: false,
        required: true,
        description: 'Trigger when a specific tag is added to the contact (e.g., "VIP" gets added).',
    },
    [TRIGGER_FILTER_FIELDS.TAG_REMOVED]: {
        title: 'Tag Removed',
        key: TRIGGER_FILTER_FIELDS.TAG_REMOVED,
        field: TRIGGER_FILTER_FIELDS.TAG_REMOVED,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT_TAG,
        required: true,
        multiple: false,
        description: 'Trigger when a specific tag is removed from the contact (e.g., "inactive" gets yanked).',
    },

    //BROADCAST_ID
    [TRIGGER_FILTER_FIELDS.BROADCAST_ID]: {
        title: 'Broadcast',
        key: TRIGGER_FILTER_FIELDS.BROADCAST_ID,
        type: TRIGGER_FILTER_VALUE_TYPES.SELECT_BROADCAST,
        valueType: TRIGGER_FILTER_VALUE_TYPES.SELECT_BROADCAST,
        field: TRIGGER_FILTER_FIELDS.BROADCAST_ID,
        operator: TRIGGER_FILTER_OPERATORS.EQUALS,
        required: true,
        description: 'Select a broadcast to trigger on.',
    }
} as const;

export const DateBasedFiltersData = [
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.MONTH],
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.DAY],
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.BEFORE_DAYS],
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.AFTER_DAYS],
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.ON_DAY],
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.HAS_TAG],
    TriggerFilterFields[TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG],
] satisfies Filter[]; // Satisfies handles type; readonly now compatible

export const TRIGGER_EVENTS = [
    defineTriggerEvent({
        key: EventKeys.BIRTHDAY,
        title: 'Birthday Reminder',
        description: 'Sends a reminder when a contact’s birthday arrives.',
        allowedActions: allowedEvents[EventKeys.BIRTHDAY],
        metadata: {
            availableFilters: DateBasedFiltersData,
        },
    }),
    defineTriggerEvent({
        key: EventKeys.ANNIVERSARY,
        title: 'Anniversary Reminder',
        description: 'Sends a reminder when a contact’s anniversary arrives.',
        allowedActions: allowedEvents[EventKeys.ANNIVERSARY],
        metadata: {
            availableFilters: DateBasedFiltersData,
        },
    }),
    defineTriggerEvent({
        key: EventKeys.CONTACT_ADDED,
        title: 'Contact Added',
        description: 'Triggers when a contact is added in the system.',
        allowedActions: allowedEvents[EventKeys.CONTACT_ADDED],
        metadata: {
            // requiredFilters: [TRIGGER_FILTER_FIELDS.ACTION],
            availableFilters: [
                // TriggerFilterFields[TRIGGER_FILTER_FIELDS.ACTION],
                // TriggerFilterFields[TRIGGER_FILTER_FIELDS.UPDATED_FIELDS],
            ],
        },
    }),
    defineTriggerEvent({
        key: EventKeys.CONTACT_ADDED_TO_BROADCAST,
        title: 'Contact Added to Broadcast',
        description: 'Triggers when a contact is added to a broadcast.',
        allowedActions: allowedEvents[EventKeys.CONTACT_ADDED_TO_BROADCAST],
        metadata: {
            requiredFilters: [TRIGGER_FILTER_FIELDS.BROADCAST_ID],
            availableFilters: [
                TriggerFilterFields[TRIGGER_FILTER_FIELDS.BROADCAST_ID],
                // TriggerFilterFields[TRIGGER_FILTER_FIELDS.ACTION],
                // TriggerFilterFields[TRIGGER_FILTER_FIELDS.UPDATED_FIELDS],
            ],
        },
    }),
    defineTriggerEvent({
        key: EventKeys.KEYWORD,
        title: 'Keyword Trigger',
        description: 'Triggers when a user sends a message containing a specific keyword or phrase.',
        allowedActions: allowedEvents[EventKeys.KEYWORD],
        metadata: {
            requiredFilters: [TRIGGER_FILTER_FIELDS.KEYWORD, TRIGGER_FILTER_FIELDS.MATCH_CONDITION],
            availableFilters: [
                TriggerFilterFields[TRIGGER_FILTER_FIELDS.KEYWORD],
                TriggerFilterFields[TRIGGER_FILTER_FIELDS.MATCH_CONDITION],
            ],
        },
    }),

    // NEW: Add this right at the end
    defineTriggerEvent({
        key: EventKeys.CONTACT_TAG,
        title: 'Contact Tag',
        description: 'Triggers when a tag is added or removed from a contact.',
        allowedActions: allowedEvents[EventKeys.CONTACT_TAG],
        metadata: {
            requiredFilters: [TRIGGER_FILTER_FIELDS.TAG_ADDED, TRIGGER_FILTER_FIELDS.TAG_REMOVED],
            availableFilters: [
                TriggerFilterFields[TRIGGER_FILTER_FIELDS.TAG_ADDED],
                TriggerFilterFields[TRIGGER_FILTER_FIELDS.TAG_REMOVED],
            ], // Both filters available; user picks one (or both?) in UI
        },
    }),
] satisfies TriggerEvent[];


export const ACTION_CONFIG_FIELDS = {
    RECIPIENT: 'recipient',
    SENDER_NUMBER: 'sender_number',
    RECEIVER_NUMBER: 'receiver_number',
    RECEIVER_LIST: ["sub-user", "recipient", "contact"],
    MESSAGE: 'message',
    MEDIA_URL: 'mediaUrl',
    MESSAGE_TEMPLATE: 'message_template',
    ORDER_ID_FIELD: 'orderIdField',
    INTEGRATION: 'integration',
    SYNC_TYPE: 'syncType',

    TAG_IDS: 'tagIds',
    TAG_ID: 'tagId',
    BROADCAST_IDS: 'broadcastIds',
    BROADCAST_ID: 'broadcastId',
    CONTACT_IDS: 'contactIds',
    REASON: 'reason',
} as const;

export const ACTION_CONFIG_FIELD_TYPES = {
    SELECT_RECIPIENT: 'select_recipient',
    SELECT_SENDER: 'select_sender',
    PHONE_INPUT: 'phone_input',
    TEXTAREA: 'textarea',
    TEXT: 'text',
    SELECT_MESSAGE_TEMPLATE: 'select_message_template',
    SELECT: 'select',
    SELECT_TAG: 'select_tag',
    SELECT_BROADCAST: 'select_broadcast',
} as const;

export type ActionConfigField = keyof typeof ACTION_CONFIG_FIELDS;
export type ActionConfigFieldType = keyof typeof ACTION_CONFIG_FIELD_TYPES;

export const ActionConfigFields = {
    [ACTION_CONFIG_FIELDS.RECIPIENT]: {
        key: ACTION_CONFIG_FIELDS.RECIPIENT,
        title: 'Recipient',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_RECIPIENT,
        dynamicOptions: true,
        required: false,
        multiple: false,
        description: 'Specify the phone number of existing contact to send the WhatsApp message to. If left empty, trigger actions for this event will send only that contact when a specified action will trigger.',
    },


    //sender_number
    [ACTION_CONFIG_FIELDS.SENDER_NUMBER]: {
        key: ACTION_CONFIG_FIELDS.SENDER_NUMBER,
        title: 'Sender Number',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_SENDER,
        dynamicOptions: true,
        required: false,
        multiple: false,
        description:
            'Select the WhatsApp number used to send messages. If none is selected, Any default active number or the contact’s previously used number will be applied automatically.',
    },


    [ACTION_CONFIG_FIELDS.MESSAGE]: {
        key: ACTION_CONFIG_FIELDS.MESSAGE,
        title: 'Text Message',
        type: ACTION_CONFIG_FIELD_TYPES.TEXTAREA,
        required: true,
        description: 'Write a custom WhatsApp message to send to the recipient.',
    },
    [ACTION_CONFIG_FIELDS.MEDIA_URL]: {
        key: ACTION_CONFIG_FIELDS.MEDIA_URL,
        title: 'Media URL',
        type: ACTION_CONFIG_FIELD_TYPES.TEXT,
        required: false,
        description: 'Add a URL for media (image, video) to include in the message.',
    },
    [ACTION_CONFIG_FIELDS.MESSAGE_TEMPLATE]: {
        key: ACTION_CONFIG_FIELDS.MESSAGE_TEMPLATE,
        title: 'Template Message',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_MESSAGE_TEMPLATE,
        dynamicOptions: true,
        required: true,
        multiple: false,
        description: 'Select a predefined template for the action’s message content. Templates ensure consistent and approved messaging.',
    },

    [ACTION_CONFIG_FIELDS.INTEGRATION]: {
        key: ACTION_CONFIG_FIELDS.INTEGRATION,
        title: 'Integration',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT,
        options: [CONTACT_SOURCE_MANUAL, CONTACT_SOURCE_CSV, CONTACT_SOURCE_GOOGLE_CONTACTS, CONTACT_SOURCE_GOOGLE_SHEET] as const,
        required: true,
        description: 'Choose the external system to sync contact data to.',
    },

    [ACTION_CONFIG_FIELDS.TAG_IDS]: {
        key: ACTION_CONFIG_FIELDS.TAG_IDS,
        title: 'Tags',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_TAG,
        dynamicOptions: true,
        required: true,
        description: 'Select one or more tags to associate with this action, used for categorization or triggering specific behaviors.',

    },
    [ACTION_CONFIG_FIELDS.BROADCAST_IDS]: {
        key: ACTION_CONFIG_FIELDS.BROADCAST_IDS,
        title: 'Broadcasts',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_BROADCAST,
        dynamicOptions: true,
        required: true,
        multiple: true,
        description: 'Select one or more broadcasts to trigger as part of this action',
    },
    [ACTION_CONFIG_FIELDS.BROADCAST_ID]: {
        key: ACTION_CONFIG_FIELDS.BROADCAST_ID,
        title: 'Broadcast',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_BROADCAST,
        dynamicOptions: true,
        required: true,
        multiple: false,
        description: 'Choose a single broadcast to trigger as part of this action',
    },
    [ACTION_CONFIG_FIELDS.CONTACT_IDS]: {
        key: ACTION_CONFIG_FIELDS.CONTACT_IDS,
        title: 'Contacts',
        type: ACTION_CONFIG_FIELD_TYPES.SELECT_RECIPIENT,
        dynamicOptions: true,
        required: true,
        multiple: true,
        description: 'Select one or more contacts to target for this action',
    },
    [ACTION_CONFIG_FIELDS.REASON]: {
        key: ACTION_CONFIG_FIELDS.REASON,
        title: 'Opt-out Reason',
        type: ACTION_CONFIG_FIELD_TYPES.TEXT,
        required: false,
        description: 'Provide an optional reason or note for this action, useful for auditing or tracking purposes.',

    },
} as const;

// Reusable action definitions (all original configs intact)
export const TRIGGER_ACTIONS = [
    {
        key: ActionKeys.SEND_WHATSAPP_MESSAGE,
        title: 'Send WhatsApp Message',
        description: "Sends a message when a trigger action is triggered.",
        metadata: {
            hasRadioGroup: true,
            radioGroups: [
                [ACTION_CONFIG_FIELDS.MESSAGE, ACTION_CONFIG_FIELDS.MESSAGE_TEMPLATE],
            ],
            groupTitles: ['Message Type'],
            configFields: [
                ActionConfigFields[ACTION_CONFIG_FIELDS.MESSAGE],
                ActionConfigFields[ACTION_CONFIG_FIELDS.MESSAGE_TEMPLATE],
                ActionConfigFields[ACTION_CONFIG_FIELDS.SENDER_NUMBER],
            ],

        },
    },

    {
        key: ActionKeys.ADD_TAG_TO_CONTACT,
        title: 'Add Tag to Contact',
        description: "Associates one or more tags with a contact for categorization or triggering specific behaviors.",
        metadata: {
            configFields: [
                ActionConfigFields[ACTION_CONFIG_FIELDS.TAG_IDS],
            ],
        },
    },
    {
        key: ActionKeys.UNSUBSCRIBE_BROADCAST,
        title: 'Unsubscribe Contact from a Broadcast',
        description: "Unsubscribe a contact from a specific broadcast, preventing them from receiving further messages from that broadcast.",
        metadata: {
            configFields: [
                ActionConfigFields[ACTION_CONFIG_FIELDS.BROADCAST_ID],
            ],
        },
    },

    {
        key: ActionKeys.UNSUBSCRIBE_FROM_ALL_BROADCAST,
        title: 'Unsubscribe Contact from All Broadcasts',
        description: 'Unsubscribes a contact from all broadcast lists, preventing them from receiving any future broadcast messages.',
        metadata: {
            configFields: [],
        }
    },

    {
        key: ActionKeys.PAUSE_BROADCAST,
        title: 'Pause Contact from a Broadcast',
        description: 'Temporarily pauses a contact participation in a broadcast, preventing message delivery to them until resumed.',
        metadata: {
            configFields: [
                ActionConfigFields[ACTION_CONFIG_FIELDS.BROADCAST_ID],
            ],
        },
    },
    {
        key: ActionKeys.PAUSE_FROM_ALL_BROADCAST,
        title: 'Pause Contact from All Broadcasts',
        description: 'Temporarily pauses a contact across all active broadcast campaigns, preventing any messages from being delivered to them until manually resumed.',
        metadata: {
            configFields: [],
        }
    },
    {
        key: ActionKeys.OPTOUT_CONTACT,
        title: 'Opt-out Contact from Future Messaging',
        description: "Marks a contact as opted out, preventing them from receiving any further messages across all campaigns or broadcasts.",

        metadata: {

            configFields: [
            ],
        },
    },

    {
        key: ActionKeys.ADD_CONTACT_TO_BROADCAST,
        title: 'Add Contact to Broadcast',
        description: "Adds a contact to a specific broadcast, allowing them to receive messages sent from that broadcast.",
        metadata: {
            configFields: [
                ActionConfigFields[ACTION_CONFIG_FIELDS.BROADCAST_ID],
            ],
        },
    }

] satisfies Action[];


export // Mutual exclusivity map: each key maps to an array of conflicting filter keys
    const MUTUALLY_EXCLUSIVE_FILTERS: Record<string, string[]> = {
        // Time-based filters: can't trigger before, after, and on the same day
        before_days: ["after_days", "day"],
        after_days: ["before_days", "day"],
        on_day: [], // Added day
        day: ["before_days", "after_days"], // Added on_day
        // Tag-based filters: can't have and not have the same tag
        has_tag: ["doesnt_have_tag"],
        doesnt_have_tag: ["has_tag"],
        // Quantity-based filters (for future use)
        min_count: ["max_count", "equals_n"],
        max_count: ["min_count", "equals_n"],
        equals_n: ["min_count", "max_count"],
        // Match type filters (for future use)
        exact_match: ["partial_match", "contains", "not_contains"],
        partial_match: ["exact_match", "contains", "not_contains"],
        contains: ["exact_match", "partial_match", "not_contains"],
        not_contains: ["exact_match", "partial_match", "contains"],
        // Status filters (for future use)
        is_active: ["is_inactive", "is_disabled"],
        is_inactive: ["is_active", "is_enabled"],
        is_enabled: ["is_disabled", "is_inactive"],
        is_disabled: ["is_enabled", "is_active"],
        is_verified: ["is_unverified"],
        is_unverified: ["is_verified"],
    };