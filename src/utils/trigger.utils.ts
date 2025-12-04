import { allowedEvents, type ActionKeys, type EventKeys } from "src/types/triggers";

// Get allowed actions for a given event key
export const getAllowedActions = (eventKey: EventKeys): ActionKeys[] => {
    return allowedEvents[eventKey] || [];
};