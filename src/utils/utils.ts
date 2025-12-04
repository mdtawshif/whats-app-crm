// utils/normalizeText.ts
import _ from "lodash";

/**
 * Normalizes keys or constants into a human-readable format.
 * Examples:
 *  - "ActionKeys.ADD_TAG_TO_CONTACT" → "Add Tag To Contact"
 *  - "ADD_TAG_TO_CONTACT" → "Add Tag To Contact"
 *  - "user_created_event" → "User Created Event"
 *  - "userCreatedEvent" → "User Created Event"
 */
export function normalizeText(value: string): string {
    if (!value) return "";

    // Remove common prefixes like "ActionKeys.", "EventKeys.", etc.
    const cleaned = value.replace(/^[A-Za-z]+Keys\./, "");

    // Lowercase everything before formatting
    return _.startCase(_.toLower(cleaned));
    // return value
}

/**
 * Remove trailing slash from a given URL or path.
 *
 * @example
 * removeTrailingSlash("https://example.com/") // "https://example.com"
 * removeTrailingSlash("https://example.com/api/") // "https://example.com/api"
 * removeTrailingSlash("https://example.com") // "https://example.com"
 */
export function removeTrailingSlash(url: string): string {
    return url.replace(/\/+$/, "");
}


export async function getPublicIP() {
    try {
        // Fetch the public IP from a service (e.g., api.ipify.org)
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json(); // Parse the JSON response
        // console.log('Your public IP address is:', data.ip);  // Access the IP from the response
        return data.ip;
    } catch (error) {
        console.error("Error fetching public IP address:", error);
    }
}

/**
 * Normalize a string into a kebab-case slug
 * - trims extra spaces
 * - replaces underscores/spaces with hyphens
 * - lowercases everything
 * - removes non-alphanumeric (except hyphen)
 */
export const normalizeString = (input: string): string => {
    return input
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-')     // replace spaces/underscores with hyphen
        .replace(/[^a-z0-9-]/g, '')  // remove invalid chars
        .replace(/-+/g, '-')         // collapse multiple hyphens
        .replace(/^-|-$/g, '');      // trim leading/trailing hyphens
};

/**
 * Give a valid Google Sheets URL,
 * Extract the spreadsheet ID from a Google Sheets URL
 * @param url
 * @returns 
 */

export function extractSpreadsheetId(url: string): string | null {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Make a valid Google Sheets  Export  URL csv export from a spreadsheet ID
 * @param spreadsheetId 
 * @returns 
 */
export function makeGoogleSheetExportUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
}

/**
 * Make a valid Google Sheet URL from a spreadsheet ID
 * @param spreadsheetId 
 * @returns 
 */
export function makeGoogleSheetUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}   