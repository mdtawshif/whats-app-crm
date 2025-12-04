/**
 * Utility class for working with bitwise values (powers of 2).
 *
 * Provides methods to validate whether a given bigint value
 * is a bitwise value (i.e., a power of 2) and to calculate
 * the next bitwise value.
 *
 * Examples of bitwise values: 1n (2^0), 2n (2^1), 4n (2^2), 8n (2^3), etc.
 */
export class BitwiseUtil {
  /**
   * Checks if the given bigint value is a bitwise value (power of 2).
   *
   * A bitwise value is positive and contains only one bit set in its binary representation.
   *
   * @param id The bigint value to check.
   * @returns true if the value is a power of 2, otherwise false.
   */
  static isBitwiseValue(id: bigint | null | undefined): boolean {
    if (id == null) {
      return false;
    }
    if (id <= 0n) {
      return false;
    }
    // A power of 2 has exactly one bit set:
    return (id & (id - 1n)) === 0n;
  }

  /**
   * Calculates the next bitwise value (power of 2) for the given bigint.
   *
   * Example:
   * - If input is 2n (2^1), output will be 4n (2^2).
   * - If input is 4n (2^2), output will be 8n (2^3).
   *
   * @param id The current bigint value (must be a power of 2).
   * @returns The next power of 2 as a bigint.
   * @throws Error if input is null, non-positive, or not a power of 2.
   */
  static nextBitwiseValue(id: bigint | null | undefined): bigint {
    if (id == null || id <= 0n) {
      throw new Error("Input must be a positive bigint.");
    }
    if (!this.isBitwiseValue(id)) {
      throw new Error("Input must be a bitwise value (power of 2).");
    }
    return id << 1n; // Shift left = multiply by 2
  }
}
