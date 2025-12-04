/**
 * Parses the area code from a virtual number / DID.
 * Assumes number is in format: country code + area code + local number.
 * Example: 18666930036 -> country: 1, area code: 866, number: 6930036
 */
function parseAreaCode(virtualNumber: string): string | null {
  // Remove non-digits just in case (if input like +1-866-693-0036)
  const cleanNumber = virtualNumber.replace(/\D/g, '');

  // Ensure it’s at least long enough: 1 + 3 + 7 digits
  if (cleanNumber.length < 11) {
    console.error(`Invalid virtual number: ${virtualNumber}`);
    return null;
  }

  // Extract area code: skip country code (1 digit), take next 3
  const areaCode = cleanNumber.slice(1, 4);

  return areaCode;
}

export default parseAreaCode;

// Define the Toll-Free area codes as an enum
export enum TollFreeAreaCode {
  _800 = '800',
  _888 = '888',
  _877 = '877',
  _866 = '866',
  _855 = '855',
  _844 = '844',
  _833 = '833',
}

export function isTollFreeAreaCode(areaCode: TollFreeAreaCode): boolean {
  return Object.values(TollFreeAreaCode).includes(areaCode);
}
