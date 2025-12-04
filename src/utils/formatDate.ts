// utils/formatDate.ts

import type { ParsedDate } from "src/types/utils";



// Parse a single date into year, month, day
export function parseBirthAnniversaryDate(dateStr: string | Date): ParsedDate {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new Error(
            `Invalid date: ${dateStr}. Must be a valid ISO 8601 date (e.g., 1990-05-15)`
        );
    }

    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1, // Months are 0-based in JS
        day: date.getDate(),
        date,
    };
}

