import type { Contact, ContactTag, Tag } from '@prisma/client';
import  { Filter } from '../triggers/index';
type ContactWithTags = Contact & {
    ContactTag: (ContactTag & { tag: Tag })[];
};



/**
 * Metrics for tracking contact upload results.
 */
 export interface ContactUploadMetrics {
    total: number;
    successful: number;
    createCount: number;
    editCount: number;
    failed: number;
    duplicateCount: number;
    errors: string[];
}


export { ContactWithTags, Filter as ContactFilter };