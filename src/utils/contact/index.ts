import type { Contact } from "@prisma/client";
import _ from "lodash";

/** 
 * 
 *  @Method to get contact name
 * @param contact 
 * @returns 
 */
export function getContactDisplayName(contact?: Contact & { displayName?: string } | null): string {

    if (!contact) return "Unknown";

    if (contact?.displayName) return contact?.displayName;


    const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");
    return name || contact?.number || "Unknown";
}



/**
 * Deeply compares two objects and returns only the changed fields.
 * Handles null/undefined equivalence and normalizes dates.
 */
export function getChangedFields<T extends Record<string, any>>(original: T, incoming: Partial<T>): Partial<T> {
    const normalizeValue = (value: any) => {
        if (value === undefined || value === null || value === "") return null; // Treat undefined and null as equivalent
        if (value instanceof Date) return value.toISOString().split("T")[0]; // Compare only date part
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return value.split("T")[0]; // Already an ISO date string
        }
        return value;
    };

    return _.pickBy(incoming, (value, key) => {
        // Skip if the key doesn't exist in incoming or is explicitly undefined
        if (!(key in incoming) || value === undefined) return false;

        const v1 = normalizeValue(value);
        const v2 = normalizeValue(original[key]);
        return !_.isEqual(v1, v2);
    }) as Partial<T>;
}