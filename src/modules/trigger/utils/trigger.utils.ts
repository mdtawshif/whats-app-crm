import type { PrismaService } from 'nestjs-prisma';
import { TriggerContext } from '../interfaces/trigger.interface';
import type { ContactFilter, ContactWithTags } from 'src/types/contacts';
import { DateTime } from 'luxon';
import { Prisma, ContactTriggerEventType, type Contact, type CacheTriggerEventActionQueue } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { isPhoneLike } from '@/utils/phone-numbers/format-phone-number';
import { TRIGGER_FILTER_FIELDS, TRIGGER_FILTER_OPERATORS } from '../constants/trigger.constant';
import type { WhatsappMessageActionContact } from 'src/types/triggers/wa-message-action-executor.config.types';
import type { PinoLogger } from 'nestjs-pino';
import type { CacheTriggerEventActionQueueWithPayload } from 'src/types/triggers/extended-trigger-prisma.types';

export class TriggerUtils {

    /**
     * Safely parses the trigger payload — supports JSON string or already-parsed object.
     * Logs parsing errors but never throws, ensuring trigger queue keeps rolling.
     *
     * @param rawPayload - Raw string from DB or pre-parsed object
     * @param logger - Optional PinoLogger for context logging
     * @returns Parsed payload object or empty {} on failure
     */
    /**
 * Safely parses the trigger payload — supports:
 * - Plain JSON string
 * - Double-escaped JSON string (common from DB or queue)
 * - Object-wrapped JSON (like { "..." })
 * - Already parsed object
 *
 * Never throws — always returns {} if parsing fails.
 */
    static parseTriggerCacheQueuePayload(
        rawPayload: string | Record<string, any> | null | undefined,
        logger?: PinoLogger,
    ): CacheTriggerEventActionQueueWithPayload['payload'] {
        if (!rawPayload) {
            logger?.warn('Empty trigger payload received');
            return {};
        }

        try {
            const parsed = JSON.parse(rawPayload as string);
            return parsed;
        } catch (error) {

        }
    }


    /**
     * Checks if the current UTC time matches the given time string within a 30-minute window.
     * Used for on_day filter validation, matching TriggerBirthAnniversaryEventProcessorService.
     * @param timeStr - UTC time in HH:MM format (e.g., "14:30")
     * @returns boolean - True if current time is within 30 minutes of timeStr
     */
    static isCurrentTimeMatching(timeStr: string): boolean {
        try {
            const now = DateTime.now().toUTC();
            const [hours, minutes] = timeStr.split(':').map(Number);

            if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
                console.error(`Invalid UTC time format ${timeStr}, expected HH:MM`);
                return false;
            }

            const targetTime = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
            const diffMinutes = Math.abs(now.diff(targetTime, 'minutes').minutes);
            return diffMinutes <= 30;
        } catch (error) {
            console.error(`Error parsing UTC time string ${timeStr}: ${error.message}`);
            return false;
        }
    }


    /**
     * Normalize Trigger context input IDs — parse single or multiple IDs
     * and return a bigint[] safely.
     * 
     * - Converts valid numeric strings and bigints to BigInt
     * - Ignores phone-like numbers (keeps them as string identifiers)
     */
    static normalizeContextIds(
        ids: string | string[] | bigint | bigint[] | null | undefined
    ): (bigint | string)[] {
        if (!ids) return [];

        const parseId = (val: string | bigint): bigint | string | null => {
            if (typeof val === 'bigint') return val;

            const str = String(val).trim();
            if (!str) return null;

            // Detect and skip phone-like values
            if (isPhoneLike(str)) return str;

            try {
                return BigInt(str);
            } catch {
                return str; // fallback to string if not a valid bigint
            }
        };

        if (Array.isArray(ids)) {
            return ids
                .map(parseId)
                .filter((v): v is bigint | string => v !== null);
        }

        const parsed = parseId(ids);
        return parsed ? [parsed] : [];
    }


    /**
     * Normalize Trigger context input IDs to bigint[]
     */
    static normalizeIdsAsBigInt(
        ids: string | number | bigint | (string | number | bigint)[] | null | undefined
    ): bigint[] {
        return this.normalizeContextIds(ids as any).map((id) => BigInt(id));
    }


    /**
     * Normalize contact IDs to array format
     */
    static normalizeContactIds(contactIds: string | string[] | bigint | bigint[]): bigint[] {
        if (Array.isArray(contactIds)) {
            return contactIds.map(id => typeof id === 'string' ? BigInt(id) : id);
        }

        return [typeof contactIds === 'string' ? BigInt(contactIds) : contactIds];
    }

    static isContactFilterArray(value: unknown): value is ContactFilter<string>[] {
        return (
            Array.isArray(value) &&
            value.every(
                (item) =>
                    typeof item === 'object' &&
                    item !== null &&
                    'field' in item &&
                    'operator' in item &&
                    'value' in item
            )
        );
    }

    /**
     * Check if today matches a given date (ignoring year)
     */
    static isDateToday(date: Date): boolean {
        const today = new Date();
        return (
            today.getMonth() === date.getMonth() &&
            today.getDate() === date.getDate()
        );
    }

    /**
     * Check if a date is within a range of days from today
     */
    static isDateWithinDays(date: Date, daysBefore: number, daysAfter: number): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const targetDate = new Date(date);
        targetDate.setFullYear(today.getFullYear()); // Use current year

        // If date already passed this year, use next year
        if (targetDate < today) {
            targetDate.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= -daysAfter && diffDays <= daysBefore;
    }

    /**
  * Apply dynamic template substitutions to a message.
  * Supports placeholders like {key} or {{key}}.
  */
    static applyMessageTemplateReplacementsForPersonalization(template: string, contact: Contact, context?: CacheTriggerEventActionQueue & { payload: any }): string {
        if (!template) return '';

        const replacements: Record<string, string> = {
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            email: contact.email || '',
            phone: contact.number || '',
            birthDate: context?.payload?.birthDate?.toLocaleDateString?.() || '',
            anniversaryDate: context?.payload?.anniversaryDate?.toLocaleDateString?.() || '',
        };

        // Supports `{key}` or `{{key}}` — whitespace inside is fine too
        return template.replace(/\{{1,2}\s*(\w+)\s*\}{1,2}/g, (_, key) => {
            return replacements[key] ?? '';
        });
    }



    /**
     * Chunk an array into smaller arrays of specified size
     */
    static chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Retrieves contacts in chunks for large datasets, optimized with parallel fetching
     * @param prisma PrismaService instance
     * @param agencyId The agency ID to filter contacts
     * @param userId The user ID to filter contacts
     * @param contactIds Optional array of contact IDs to fetch specific contacts
     * @param chunkSize Maximum number of contacts to fetch in a single query (default: 100)
     * @param maxBatches Maximum number of concurrent batches (default: 5)
     * @returns Array of contacts with their tags
     * @throws BadRequestException if chunkSize or maxBatches is invalid
     */
    static async getContactsInChunks(
        prisma: PrismaService,
        agencyId: bigint,
        userId: bigint,
        contactIds?: bigint[],
        chunkSize: number = 100,
        maxBatches: number = 5,
    ): Promise<ContactWithTags[]> {
        // Input validation
        if (chunkSize <= 0 || maxBatches <= 0) {
            throw new BadRequestException('chunkSize and maxBatches must be positive integers');
        }

        console.log({ 'TriggerUtils-getContactsInChunks': { contactIds, chunkSize, maxBatches } });

        const allContacts: ContactWithTags[] = [];

        // Helper to fetch contacts for a chunk of IDs
        const fetchContactsForIds = async (ids: bigint[]): Promise<ContactWithTags[]> => {
            return prisma.contact.findMany({
                where: {
                    id: { in: ids },
                    agencyId,
                    userId,
                },
                include: {
                    ContactTag: { include: { tag: true } },
                },
            });
        };

        if (contactIds && contactIds.length > 0) {
            // Process provided contactIds in chunks
            const chunks: bigint[][] = [];
            for (let i = 0; i < contactIds.length; i += chunkSize) {
                chunks.push(contactIds.slice(i, i + chunkSize));
            }

            // Process chunks in parallel, respecting maxBatches
            for (let i = 0; i < chunks.length; i += maxBatches) {
                const batch = chunks.slice(i, i + maxBatches);
                const results = await Promise.all(batch.map(fetchContactsForIds));
                allContacts.push(...results.flat());
            }
        } else {
            // Paginate through all contacts for agencyId and userId
            let skip = 0;
            let hasMore = true;

            while (hasMore) {
                // Fetch a chunk of IDs
                const contactIdsChunk = await prisma.contact.findMany({
                    where: { agencyId, userId },
                    select: { id: true },
                    take: chunkSize,
                    skip,
                });

                const ids = contactIdsChunk.map((c) => c.id);

                if (ids.length === 0) {
                    hasMore = false;
                    break;
                }

                // Fetch contacts for the chunk
                const contacts = await fetchContactsForIds(ids);
                allContacts.push(...contacts);
                skip += chunkSize;

                // Stop if we got fewer IDs than chunkSize
                if (ids.length < chunkSize) {
                    hasMore = false;
                }
            }
        }

        return allContacts;
    }

    /**
     * Get contacts by numbers
     */
    static async getContactsByNumbers(prisma: PrismaService, numbers: string[], agencyId: bigint, userId: bigint): Promise<WhatsappMessageActionContact[]> {
        // Fetch contacts for each chunk
        const allContacts: WhatsappMessageActionContact[] = [];
        const contacts = await prisma.contact.findMany({
            where: {
                number: { in: numbers },
                agencyId,
                userId
            },
            select: { id: true, number: true, firstName: true, lastName: true, email: true },

        });
        allContacts.push(...contacts)

        return allContacts
    }


    /**
      * Extract contact IDs from context, handling both single ID and array
      */
    static getContactIdsFromContext(context: TriggerContext): string[] {
        if (context.contactIds && Array.isArray(context.contactIds) && context.contactIds.length > 0) {
            return context.contactIds.map(id => id.toString());
        }

        if (context.contactId) {
            return [context.contactId.toString()];
        }

        return [];
    }
    /**
     * Builds a query to fetch contacts with birthdays or anniversaries matching filter criteria
     * @param agencyId 
     * @param eventKey 
     * @param filters 
     * @param timezone 
     * @param today 
     * @returns 
     */


    /**
  * Parses time string like "9:00 AM" to hour (24h) and minute
  * @param timeStr - e.g., "9:00 AM"
  * @returns { hour: number, minute: number } or null if invalid
  */
    public static parseTimeString(timeStr: string): { hour: number; minute: number } | null {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return null;

        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const period = match[3].toUpperCase();

        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;

        return { hour, minute };
    }

    /**
     *  Normalizes a string by converting it to lowercase and replacing underscores with spaces
     * @param key - The string to normalize
     * @returns The normalized string
     * */
    /**
  * Normalizes a key into a human-readable label.
  * Example: "ANNIVERSARY_EVENT" → "Anniversary event"
  *           "CONTACT_ADDED" → "Contact added"
  * @param key - The string key to normalize
  * @returns A human-friendly, properly formatted string
  */
    public static normalizeActionKey(key?: string): string {
        if (!key) return "";
        return key
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase());
    }

    /**
    * Builds a query to fetch contacts with birthdays or anniversaries matching filter criteria
    * When only on_day filter is provided, matches TODAY'S birthday/anniversary in the GIVEN TIMEZONE
    * @param agencyId - Agency ID to filter contacts
    * @param userId - User ID to filter contacts
    * @param eventKey - 'BIRTHDAY' or 'ANNIVERSARY'
    * @param filters - Array of filters (month, day, before_days, after_days, on_day, source, tag)
    * @param timezone - Timezone for date calculations (e.g., 'America/New_York', 'Asia/Tokyo')
    * @param today - Current date for reference (defaults to start of day in GIVEN timezone)
    * @returns { sql, params } - Prisma SQL query and parameters
    */
    public static buildContactFilterQuery(
        agencyId: bigint,
        userId: bigint,
        eventKey: ContactTriggerEventType,
        filters: ContactFilter[],
        timezone: string,
        today: DateTime = TriggerUtils.getTodayInTimezone(timezone),
    ): { sql: Prisma.Sql; params: any[] } {
        // Validate eventKey
        if (!['BIRTHDAY', 'ANNIVERSARY'].includes(eventKey)) {
            throw new BadRequestException(`Invalid eventKey: ${eventKey}`);
        }

        // Use provided today or create from timezone
        const finalToday = today.isValid ? today.setZone(timezone).startOf('day') : TriggerUtils.getTodayInTimezone(timezone);
        if (!finalToday.isValid) {
            throw new BadRequestException('Invalid today date or timezone combination');
        }

        // Log today's date in the given timezone for debugging
        console.log(`Timezone: ${timezone}`);
        console.log(`Today in timezone: ${finalToday.toISO()} (${finalToday.toFormat('yyyy-MM-dd HH:mm:ss ZZZ')})`);
        console.log(`Today month/day: ${finalToday.month}/${finalToday.day}`);

        // Column names based on event type
        const isBirthday = eventKey === ContactTriggerEventType.BIRTHDAY;
        const monthColumn = isBirthday ? 'birth_month' : 'anniversary_month';
        const dayColumn = isBirthday ? 'birth_day' : 'anniversary_day';
        const yearColumn = isBirthday ? 'birth_year' : 'anniversary_year';
        const dateColumn = isBirthday ? 'birth_date' : 'anniversary_date';

        const params: any[] = [agencyId, userId];
        const conditions: Prisma.Sql[] = [];

        // Parse filters
        const monthFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.MONTH && f.operator === TRIGGER_FILTER_OPERATORS.EQUALS);
        const dayFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.DAY && f.operator === TRIGGER_FILTER_OPERATORS.EQUALS);
        const beforeDaysFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.BEFORE_DAYS && f.operator === TRIGGER_FILTER_OPERATORS.BEFORE);
        const afterDaysFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.AFTER_DAYS && f.operator === TRIGGER_FILTER_OPERATORS.AFTER);
        const onDayFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.ON_DAY && f.operator === TRIGGER_FILTER_OPERATORS.EQUALS);
        const sourceFilter = filters.find((f) => f.field === "source" && f.operator === TRIGGER_FILTER_OPERATORS.EQUALS);
        const hasTagFilters = filters.filter((f) => f.field === TRIGGER_FILTER_FIELDS.HAS_TAG && f.operator === TRIGGER_FILTER_OPERATORS.HAS);
        const doesntHaveTagFilters = filters.filter((f) => f.field === TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG && f.operator === TRIGGER_FILTER_OPERATORS.NOT_HAS);

        // Calculate target date (still respects before/after days relative to timezone today)
        let targetDate = finalToday;
        if (beforeDaysFilter) {
            const days = parseInt(beforeDaysFilter.value, 10);
            if (isNaN(days) || days < 0 || days > 365) {
                throw new BadRequestException(`Invalid before_days value: ${beforeDaysFilter.value}`);
            }
            targetDate = finalToday.plus({ days });
            console.log(`beforeDaysFilter: ${days} days, targetDate: ${targetDate.toISO()}`);
        } else if (afterDaysFilter) {
            const days = parseInt(afterDaysFilter.value, 10);
            if (isNaN(days) || days < 0 || days > 365) {
                throw new BadRequestException(`Invalid after_days value: ${afterDaysFilter.value}`);
            }
            targetDate = finalToday.minus({ days });
            console.log(`afterDaysFilter: ${days} days, targetDate: ${targetDate.toISO()}`);
        }

        // Handle date condition: only if month/day filters OR only on_day (today's date in timezone)
        if (monthFilter || dayFilter || (onDayFilter && filters.length === 1)) {
            let targetMonth: number;
            let targetDay: number;

            if (filters.length === 1 && onDayFilter) {
                // ONLY on_day filter: use TODAY'S month and day in the GIVEN timezone
                targetMonth = finalToday.month;
                targetDay = finalToday.day;
                console.log(`Only on_day filter: using today in timezone ${timezone} -> month: ${targetMonth}, day: ${targetDay}`);
            } else {
                // Explicit month/day filters or other combinations
                targetMonth = monthFilter ? TriggerUtils.getMonthNumber(monthFilter.value) : targetDate.month;
                if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
                    throw new BadRequestException(`Invalid month: ${monthFilter?.value || targetDate.month}`);
                }

                targetDay = dayFilter ? parseInt(dayFilter.value, 10) : targetDate.day;
                if (isNaN(targetDay) || targetDay < 1 || targetDay > 31) {
                    throw new BadRequestException(`Invalid day: ${dayFilter?.value || targetDate.day}`);
                }
                console.log(`Combined filters: targetMonth: ${targetMonth}, targetDay: ${targetDay}`);
            }

            // Build date condition for the target month/day (today's date when only on_day)
            const baseSplitCondition = Prisma.sql`${Prisma.raw(monthColumn)} = ${targetMonth} AND ${Prisma.raw(dayColumn)} = ${targetDay}`;
            const baseFallbackCondition = Prisma.sql`MONTH(${Prisma.raw(dateColumn)}) = ${targetMonth} AND DAY(${Prisma.raw(dateColumn)}) = ${targetDay}`;

            let dateCondition: Prisma.Sql;
            if (targetMonth === 2 && targetDay === 29 && !targetDate.isInLeapYear) {
                // Handle February 29th in non-leap years (use Feb 28 or March 1)
                dateCondition = Prisma.sql`(
          (
            ${Prisma.raw(monthColumn)} IS NOT NULL AND
            ${Prisma.raw(dayColumn)} IS NOT NULL AND
            ${Prisma.raw(yearColumn)} IS NOT NULL AND
            ((${Prisma.raw(monthColumn)} = 2 AND ${Prisma.raw(dayColumn)} = 28) OR
             (${Prisma.raw(monthColumn)} = 3 AND ${Prisma.raw(dayColumn)} = 1))
          ) OR (
            (
              ${Prisma.raw(monthColumn)} IS NULL OR
              ${Prisma.raw(dayColumn)} IS NULL OR
              ${Prisma.raw(yearColumn)} IS NULL
            ) AND
            ${Prisma.raw(dateColumn)} IS NOT NULL AND
            ((MONTH(${Prisma.raw(dateColumn)}) = 2 AND DAY(${Prisma.raw(dateColumn)}) = 28) OR
             (MONTH(${Prisma.raw(dateColumn)}) = 3 AND DAY(${Prisma.raw(dateColumn)}) = 1))
          )
        )`;
            } else {
                dateCondition = Prisma.sql`(
          (
            ${Prisma.raw(monthColumn)} IS NOT NULL AND
            ${Prisma.raw(dayColumn)} IS NOT NULL AND
            ${Prisma.raw(yearColumn)} IS NOT NULL AND
            ${baseSplitCondition}
          ) OR (
            (
              ${Prisma.raw(monthColumn)} IS NULL OR
              ${Prisma.raw(dayColumn)} IS NULL OR
              ${Prisma.raw(yearColumn)} IS NULL
            ) AND
            ${Prisma.raw(dateColumn)} IS NOT NULL AND
            ${baseFallbackCondition}
          )
        )`;
            }
            conditions.push(dateCondition);
        }

        // Filter out future dates (only if date-related filters or only on_day)
        if (monthFilter || dayFilter || beforeDaysFilter || afterDaysFilter || (onDayFilter && filters.length === 1)) {
            conditions.push(
                Prisma.sql`(
          (${Prisma.raw(yearColumn)} IS NOT NULL AND ${Prisma.raw(yearColumn)} <= ${targetDate.year + 1}) OR
          (${Prisma.raw(dateColumn)} IS NOT NULL AND YEAR(${Prisma.raw(dateColumn)}) <= ${targetDate.year + 1}) OR
          (${Prisma.raw(yearColumn)} IS NULL AND ${Prisma.raw(dateColumn)} IS NULL)
        )`,
            );
        }

        // Source filter
        if (sourceFilter) {
            params.push(BigInt(sourceFilter.value));
            conditions.push(Prisma.sql`source_id = ${params[params.length - 1]}`);
        }

        // Tag filters (unchanged)
        const tagConditions: Prisma.Sql[] = [];
        hasTagFilters.forEach((filter) => {
            const tagIds = Array.isArray(filter.value) ? filter.value : [filter.value];
            tagIds.forEach((tagId) => {
                params.push(BigInt(tagId));
                tagConditions.push(
                    Prisma.sql`EXISTS (
            SELECT 1 FROM contact_tags ct
            WHERE ct.contact_id = contacts.id
            AND ct.tag_id = ${params[params.length - 1]}
          )`,
                );
            });
        });

        doesntHaveTagFilters.forEach((filter) => {
            const tagIds = Array.isArray(filter.value) ? filter.value : [filter.value];
            tagIds.forEach((tagId) => {
                params.push(BigInt(tagId));
                tagConditions.push(
                    Prisma.sql`NOT EXISTS (
            SELECT 1 FROM contact_tags ct
            WHERE ct.contact_id = contacts.id
            AND ct.tag_id = ${params[params.length - 1]}
          )`,
                );
            });
        });

        if (tagConditions.length > 0) {
            conditions.push(Prisma.sql`(${Prisma.join(tagConditions, ' AND ')})`);
        }

        // On-day time filter (30-minute window around specified UTC time TODAY)
        if (onDayFilter) {
            const [hours, minutes] = onDayFilter.value.split(':').map(Number);

            if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
                throw new BadRequestException(`Invalid UTC time format in on_day: ${onDayFilter.value}. Expected: HH:MM`);
            }

            // Create target time TODAY in UTC
            const targetTime = DateTime.now().toUTC().set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
            if (!targetTime.isValid) {
                throw new BadRequestException(`Invalid UTC target time calculated from ${onDayFilter.value}`);
            }

            const windowStart = targetTime.minus({ minutes: 30 }).toJSDate();
            const windowEnd = targetTime.plus({ minutes: 30 }).toJSDate();

            console.log(`on_day ${onDayFilter.value} in UTC:`);
            console.log(`  Target time: ${targetTime.toISO()} (${targetTime.toFormat('HH:mm:ss ZZZ')})`);
            console.log(`  Window: ${windowStart} to ${windowEnd}`);

            params.push(windowStart, windowEnd);
            conditions.push(
                Prisma.sql`NOT EXISTS (
          SELECT 1 FROM trigger_event_execution_logs tel
          WHERE tel.contact_id = contacts.id
          AND tel.trigger_event_id = (
            SELECT id FROM trigger_events WHERE \`key\` = ${eventKey}
          )
          AND tel.executed_at >= ${params[params.length - 2]}
          AND tel.executed_at < ${params[params.length - 1]}
        )`,
            );
        }

        // Ensure at least one date field is present (only if date-related filters or only on_day)
        if (monthFilter || dayFilter || beforeDaysFilter || afterDaysFilter || (onDayFilter && filters.length === 1)) {
            conditions.push(
                Prisma.sql`(
          ${Prisma.raw(dateColumn)} IS NOT NULL OR
          (${Prisma.raw(monthColumn)} IS NOT NULL AND ${Prisma.raw(dayColumn)} IS NOT NULL AND ${Prisma.raw(yearColumn)} IS NOT NULL)
        )`,
            );
        }

        // Build final query
        const sql = Prisma.sql`
      SELECT id FROM contacts
      WHERE agency_id = ${params[0]}
      AND user_id = ${params[1]}
      ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}
    `;

        console.log('Generated SQL conditions count:', conditions.length);
        console.log('Final params:', params.map((p, i) => ({ index: i, value: p })));

        return { sql, params };
    }

    /**
     * Utility to convert month name to number
     */
    public static getMonthNumber(month: string): number {
        const monthMap: { [key: string]: number } = {
            january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
            april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
            august: 8, aug: 8, september: 9, sep: 9, october: 10, oct: 10,
            november: 11, nov: 11, december: 12, dec: 12,
        };
        const monthNum = parseInt(month, 10) || monthMap[month.toLowerCase()];
        if (isNaN(monthNum as any) || monthNum < 1 || monthNum > 12) {
            throw new BadRequestException(`Invalid month value: ${month}`);
        }
        return monthNum;
    }

    /**
     * Helper to get today in a specific timezone (for testing or explicit calls)
     * @param timezone - IANA timezone string (e.g., 'America/New_York')
     * @returns DateTime object at start of day in the given timezone
     */
    public static getTodayInTimezone(timezone: string): DateTime {
        const today = DateTime.now().setZone(timezone).startOf('day');
        if (!today.isValid) {
            throw new BadRequestException(`Cannot get today in timezone: ${timezone}`);
        }
        return today;
    }

    /**
     * Utility to convert on_day time to UTC
     */


    public static convertOnDayTimeToUTC(timeStr: string, timezone: string): string {
        const [time, modifier] = timeStr.trim().split(' ');
        const [hours, minutes] = time.split(':').map(Number);

        if (isNaN(hours) || isNaN(minutes) || hours > 12 || minutes > 59 || !['AM', 'PM'].includes(modifier)) {
            throw new BadRequestException(`Invalid on_day time format: ${timeStr}. Expected: HH:MM AM/PM`);
        }

        let adjustedHours = hours;
        if (modifier === 'PM' && hours < 12) adjustedHours += 12;
        if (modifier === 'AM' && hours === 12) adjustedHours = 0;

        // convert local -> UTC
        const utcTime = DateTime.fromObject(
            { hour: adjustedHours, minute: minutes },
            { zone: timezone }
        ).toUTC();

        if (!utcTime.isValid) {
            throw new BadRequestException(`Invalid timezone ${timezone} for on_day time ${timeStr}`);
        }

        return utcTime.toFormat('HH:mm');
    }


    /**
     * Convert UTC on_day time to local timezone with AM/PM format
     * @param utcTime - UTC time string in HH:MM 24-hour format (e.g., "08:30")
     * @param timezone - IANA timezone string (e.g., 'America/New_York')
     * @returns Local time string in HH:MM AM/PM format (e.g., "2:30 PM")
     */
    public static convertOnDayTimeToLocal(utcTime: string, timezone: string): string {
        const [hours, minutes] = utcTime.split(':').map(Number);

        if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
            throw new BadRequestException(`Invalid UTC time format: ${utcTime}. Expected: HH:MM`);
        }

        const utcDateTime = DateTime.fromObject(
            { hour: hours, minute: minutes, second: 0, millisecond: 0 },
            { zone: 'utc' },
        );

        if (!utcDateTime.isValid) {
            throw new BadRequestException(`Invalid UTC time: ${utcTime}`);
        }

        const localDateTime = utcDateTime.setZone(timezone);
        if (!localDateTime.isValid) {
            throw new BadRequestException(`Invalid timezone: ${timezone}`);
        }

        let localHours = localDateTime.hour;
        const localMinutes = localDateTime.minute;
        const modifier = localHours >= 12 ? 'PM' : 'AM';

        if (localHours > 12) {
            localHours -= 12;
        } else if (localHours === 0) {
            localHours = 12;
        }

        return `${localHours}:${localMinutes.toString().padStart(2, '0')} ${modifier}`;
    }
}