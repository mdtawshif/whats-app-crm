/**
 * Interface for the expected payload structure in trigger queue.
 * Define this in types/triggers/index.ts for reusability.
 */
export interface TriggerValidatorCacheQueuePayload {
    birthDate?: string; // ISO or YYYY-MM-DD
    anniversaryDate?: string; // ISO or YYYY-MM-DD
    message?: string;
    action?: 'CREATED' | 'UPDATED';
    updatedFields?: string[];
    tags?: string[];
}