
import {
    EventKeys,
} from 'src/types/triggers'; // Updated import

export const TIME_BASED_TRIGGER_EVENTS = [
    EventKeys.BIRTHDAY,
    EventKeys.ANNIVERSARY,
] as const;

export const ACTION_BASED_TRIGGER_EVENTS = [
    EventKeys.KEYWORD,
    EventKeys.CONTACT_ADDED,
] as const;
