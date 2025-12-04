// server/prisma/utils/create-include.ts
import { Prisma } from '@prisma/client';

/**
 * Creates a validated Prisma include with proper type inference
 * Returns an object where each property can be extracted and reused
 * 
 * @example
 * ```ts
 * const include = createInclude<Prisma.InboxThreadInclude>()({
 *   agency: withAgency,
 *   user: withUser,
 *   contact: withContact
 * });
 * 
 * // Use the full include
 * await prisma.inboxThread.findMany({ include });
 * 
 * // Extract and reuse parts
 * await prisma.conversation.create({
 *   data: { ... },
 *   include: { agency: include.agency } //  Works!
 * });
 * ```
 */
export function createInclude<TInclude extends Record<string, any>>() {
    return <T extends Partial<TInclude>>(config: T): T & {
        [K in keyof T]: T[K]
    } => {
        return config;
    };
}

/**
 * Extracts specific keys from an include object for reuse
 * 
 * @example
 * ```ts
 * const baseInclude = createInclude<Prisma.InboxThreadInclude>()({
 *   agency: withAgency,
 *   user: withUser,
 * });
 * 
 * // Pick only agency for use in another model
 * const agencyOnly = pickFromInclude(baseInclude, 'agency');
 * 
 * await prisma.conversation.findMany({
 *   include: agencyOnly // { agency: withAgency }
 * });
 * ```
 */
export function pickFromInclude<T extends Record<string, any>, K extends keyof T>(
    include: T,
    ...keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (key in include) {
            result[key] = include[key];
        }
    }
    return result;
}

/**
 * Creates a reusable include builder that works across different models
 * 
 * @example
 * ```ts
 * const base = createReusableInclude({
 *   agency: withAgency,
 *   user: withUser,
 *   contact: withContact,
 * });
 * 
 * // Use in InboxThread
 * const threadInclude = createInclude<Prisma.InboxThreadInclude>()(base);
 * 
 * // Use only agency in Conversation
 * await prisma.conversation.create({
 *   data: { ... },
 *   include: { agency: base.agency }
 * });
 * ```
 */
export function createReusableInclude<T extends Record<string, any>>(config: T): T {
    return config;
}