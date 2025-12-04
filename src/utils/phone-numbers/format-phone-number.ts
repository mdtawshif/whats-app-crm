
/**
 * Normalizes a phone number by removing all non-digit characters.
 * Useful for storing or comparing numbers consistently.
 *
 * @param phone - The raw phone number (e.g. "+1 (415) 523-8886").
 * @returns The cleaned number with digits only (e.g. "14155238886").
 *
 * @example
 * normalizePhoneNumber("+1 (415) 523-8886"); // "14155238886"
 * normalizePhoneNumber("0044-155-238-886");  // "0044155238886"
 * normalizePhoneNumber("14155238886");       // "14155238886"
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove any non-digit characters (e.g., +, -, spaces)
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Normalizes thread numbers to ensure consistent lookup
 * @param from 
 * @param to 
 * @returns 
 */

export const normalizeThreadNumbers = (
  from: string | null | undefined,
  to: string | null | undefined
): { normalizedFrom: string; normalizedTo: string } => {
  const normalizedFrom = normalizePhoneNumber(from);
  const normalizedTo = normalizePhoneNumber(to);
  // Sort alphabetically to ensure consistent lookup
  return normalizedFrom <= normalizedTo
    ? { normalizedFrom: normalizedFrom, normalizedTo: normalizedTo }
    : { normalizedFrom: normalizedTo, normalizedTo: normalizedFrom };
};
/**
 * Detects if a given string looks like a phone number.
 * 
 *  Supports:
 * - Starts with "+" followed by digits (e.g. "+8801789456123")
 * - Or purely numeric strings with at least 8–15 digits (common phone length)
 * 
 * Rejects:
 * - Strings containing letters or symbols (except '+')
 * - Too short/too long to be realistic
 */
export function isPhoneLike(value: string): boolean {
  if (!value) return false;

  const trimmed = value.trim();

  // Must be all digits (or digits with leading '+')
  if (!/^\+?\d+$/.test(trimmed)) return false;

  // Check realistic phone number length (8–15 digits typically)
  const digitCount = trimmed.startsWith('+')
    ? trimmed.length - 1
    : trimmed.length;

  return digitCount >= 8 && digitCount <= 15;
}
