import type { TriggerEventType } from "src/types/triggers";

export interface TriggerContext {
    contactIds?: bigint[]; // Support for bulk operations
    contactId?: bigint;    // Support for single operations (backward compatibility)
    agencyId: bigint;
    userId?: bigint;
    eventData?: any;
    birthDate?: Date;
    anniversaryDate?: Date;
    validContactIds?: bigint[];
    validContacts?: any[];
    [key: string]: any;
}

export interface TriggerJob {
    event: TriggerEventType;
    context: TriggerContext;
    triggerId: bigint;
}

export interface ActionConfig {
    recipient?: string|string[];
    message?: string;
    mediaUrl?: string;
    message_template?: string;
    [key: string]: any;
}

export interface TriggerExecutionResult {
    success: boolean;
    message?: string;
}

export interface BulkProcessingResult {
    total: number;
    success: number;
    failed: number;
    errors: string[];
    duplicates?: number;
    exists?: number;
}

export interface ContactData {
    id: bigint;
    firstName?: string;
    lastName?: string;
    number?: string;
    email?: string;
    birthDate?: Date;
    anniversaryDate?: Date;
    [key: string]: any;
}