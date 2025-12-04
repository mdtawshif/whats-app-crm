import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type ContactTriggerEventType } from '@prisma/client';
import { DateTime } from 'luxon';
import type { ContactFilter } from '../../../types/contacts';
import { TRIGGER_FILTER_FIELDS, TRIGGER_FILTER_OPERATORS } from '../constants/trigger.constant';
import { EventKeys } from '../../../types/triggers';

@Injectable()
export class ContactFilterService {
    /**
     * Builds a Prisma SQL query to fetch contacts with birthdays or anniversaries
     * Handles edge cases: only day, only on_day, no filters (uses today's date)
     * @param agencyId - Agency ID to filter contacts
     * @param userId - User ID to filter contacts
     * @param eventKey - 'BIRTHDAY' or 'ANNIVERSARY'
     * @param filters - Array of filters (month, day, before_days, after_days, on_day, source, tag)
     * @param timezone - Timezone for date calculations (e.g., 'America/New_York')
     * @param today - Current date for reference (defaults to start of day in timezone)
     * @returns { sql: Prisma.Sql, params: any[] } - Prisma SQL query and parameters
     */
    static buildContactFilterQuery(
        agencyId: bigint,
        userId: bigint,
        eventKey: ContactTriggerEventType,
        filters: ContactFilter[] = [],
        timezone: string,
        today: DateTime = DateTime.now().setZone(timezone).startOf('day'),
    ): { sql: Prisma.Sql; params: any[] } {
        // Validate eventKey
        if (![EventKeys.BIRTHDAY, EventKeys.ANNIVERSARY].includes(eventKey as EventKeys)) {
            throw new BadRequestException(`Invalid eventKey: ${eventKey}`);
        }

        // Validate timezone and today
        if (!today.isValid || !DateTime.now().setZone(timezone).isValid) {
            throw new BadRequestException(`Invalid timezone or date: ${timezone}, ${today.toISO()}`);
        }

        console.log(`Building query for ${eventKey}, timezone: ${timezone}, today: ${today.toISO()}`);

        // Column names based on event type
        const isBirthday = eventKey === 'BIRTHDAY';
        const monthColumn = isBirthday ? 'birth_month' : 'anniversary_month';
        const dayColumn = isBirthday ? 'birth_day' : 'anniversary_day';
        const yearColumn = isBirthday ? 'birth_year' : 'anniversary_year';
        const dateColumn = isBirthday ? 'birth_date' : 'anniversary_date';

        const params: any[] = [agencyId, userId];
        const conditions: Prisma.Sql[] = [];

        // Parse filters
        const filterMap = this.parseFilters(filters);
        const { month, day, beforeDays, afterDays, onDay,  hasTags, doesntHaveTags } = filterMap;

        // Calculate target date
        let targetDate = today;
        if (beforeDays !== undefined) {
            targetDate = today.plus({ days: beforeDays });
            console.log(`Applied before_days: ${beforeDays}, targetDate: ${targetDate.toISO()}`);
        } else if (afterDays !== undefined) {
            targetDate = today.minus({ days: afterDays });
            console.log(`Applied after_days: ${afterDays}, targetDate: ${targetDate.toISO()}`);
        }

        // Handle date conditions (month/day or on_day)
        if (month || day || onDay || !filters.length) {
            const { targetMonth, targetDay } = this.getTargetMonthDay(month, day, onDay, filters, today);
            console.log(`Target date: month=${targetMonth}, day=${targetDay}`);

            const dateCondition = this.buildDateCondition(
                targetMonth,
                targetDay,
                targetDate,
                monthColumn,
                dayColumn,
                yearColumn,
                dateColumn,
                params,
            );
            conditions.push(dateCondition);

            // Filter out future dates
            params.push(targetDate.year + 1);
            conditions.push(
                Prisma.sql`(
          (${Prisma.raw(yearColumn)} IS NOT NULL AND ${Prisma.raw(yearColumn)} <= ${params[params.length - 1]}) OR
          (${Prisma.raw(dateColumn)} IS NOT NULL AND YEAR(${Prisma.raw(dateColumn)}) <= ${params[params.length - 1]}) OR
          (${Prisma.raw(yearColumn)} IS NULL AND ${Prisma.raw(dateColumn)} IS NULL)
        )`,
            );

            // Ensure at least one date field is present
            conditions.push(
                Prisma.sql`(
          ${Prisma.raw(dateColumn)} IS NOT NULL OR
          (${Prisma.raw(monthColumn)} IS NOT NULL AND ${Prisma.raw(dayColumn)} IS NOT NULL AND ${Prisma.raw(yearColumn)} IS NOT NULL)
        )`,
            );
        }


        // Tag filters
        if (hasTags.length || doesntHaveTags.length) {
            const tagConditions = this.buildTagConditions(hasTags, doesntHaveTags, params);
            if (tagConditions.length) {
                conditions.push(Prisma.sql`(${Prisma.join(tagConditions, ' AND ')})`);
            }
        }

        // On-day execution window (30 minutes around specified UTC time)
        if (onDay) {
            const { windowStart, windowEnd } = this.buildOnDayWindow(onDay, params);
            conditions.push(
                Prisma.sql`NOT EXISTS (
          SELECT 1 FROM trigger_event_execution_logs tel
          WHERE tel.contact_id = contacts.id
          AND tel.trigger_event_id = (SELECT id FROM trigger_events WHERE \`key\` = ${eventKey})
          AND tel.executed_at >= ${params[params.length - 2]}
          AND tel.executed_at < ${params[params.length - 1]}
        )`,
            );
            console.log(`Applied on_day window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
        }

        // Build final query
        const sql = Prisma.sql`
      SELECT id FROM contacts
      WHERE agency_id = ${params[0]}
      AND user_id = ${params[1]}
      ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}
    `;

        console.log(`Generated query: conditions=${conditions.length}, params=${params.length}`);
        console.log('Params:', params.map((p, i) => ({ index: i, value: p })));

        return { sql, params };
    }

    /**
     * Parses filters into a structured map
     */
    private static parseFilters(filters: ContactFilter[]): {
        month?: number;
        day?: number;
        beforeDays?: number;
        afterDays?: number;
        onDay?: string;
        source?: string;
        hasTags: string[];
        doesntHaveTags: string[];
    } {
        const result: ReturnType<typeof this.parseFilters> = { hasTags: [], doesntHaveTags: [] };

        for (const filter of filters) {
            switch (filter.field) {
                case TRIGGER_FILTER_FIELDS.MONTH:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.EQUALS) {
                        result.month = this.getMonthNumber(filter.value);
                    }
                    break;
                case TRIGGER_FILTER_FIELDS.DAY:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.EQUALS) {
                        const day = parseInt(String(filter.value), 10);
                        if (isNaN(day) || day < 1 || day > 31) {
                            throw new BadRequestException(`Invalid day: ${filter.value}`);
                        }
                        result.day = day;
                    }
                    break;
                case TRIGGER_FILTER_FIELDS.BEFORE_DAYS:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.BEFORE) {
                        const days = parseInt(String(filter.value), 10);
                        if (isNaN(days) || days < 0 || days > 365) {
                            throw new BadRequestException(`Invalid before_days: ${filter.value}`);
                        }
                        result.beforeDays = days;
                    }
                    break;
                case TRIGGER_FILTER_FIELDS.AFTER_DAYS:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.AFTER) {
                        const days = parseInt(String(filter.value), 10);
                        if (isNaN(days) || days < 0 || days > 365) {
                            throw new BadRequestException(`Invalid after_days: ${filter.value}`);
                        }
                        result.afterDays = days;
                    }
                    break;
                case TRIGGER_FILTER_FIELDS.ON_DAY:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.EQUALS) {
                        if (!/^\d{1,2}:\d{2}$/.test(String(filter.value))) {
                            throw new BadRequestException(`Invalid on_day format: ${filter.value}. Expected HH:MM`);
                        }
                        result.onDay = String(filter.value);
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.HAS_TAG:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.HAS) {
                        result.hasTags.push(...(Array.isArray(filter.value) ? filter.value : [filter.value]));
                    }
                    break;
                case TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG:
                    if (filter.operator === TRIGGER_FILTER_OPERATORS.NOT_HAS) {
                        result.doesntHaveTags.push(...(Array.isArray(filter.value) ? filter.value : [filter.value]));
                    }
                    break;
                default:
                    throw new BadRequestException(`Unsupported filter field: ${filter.field}`);
            }
        }

        return result;
    }

    /**
     * Determines target month and day for date-based filters
     */
    private static getTargetMonthDay(
        month: number | undefined,
        day: number | undefined,
        onDay: string | undefined,
        filters: ContactFilter[],
        today: DateTime,
    ): { targetMonth: number; targetDay: number } {
        if (!filters.length || (onDay && filters.length === 1)) {
            // No filters or only on_day: use today's month/day
            return { targetMonth: today.month, targetDay: today.day };
        }

        // Use provided month/day or fall back to today's
        const targetMonth = month ?? today.month;
        const targetDay = day ?? today.day;

        if (targetMonth < 1 || targetMonth > 12) {
            throw new BadRequestException(`Invalid month: ${targetMonth}`);
        }
        if (targetDay < 1 || targetDay > 31) {
            throw new BadRequestException(`Invalid day: ${targetDay}`);
        }

        return { targetMonth, targetDay };
    }

    /**
     * Builds date condition with leap year handling
     */
    private static buildDateCondition(
        targetMonth: number,
        targetDay: number,
        targetDate: DateTime,
        monthColumn: string,
        dayColumn: string,
        yearColumn: string,
        dateColumn: string,
        params: any[],
    ): Prisma.Sql {
        params.push(targetMonth, targetDay);

        const baseSplitCondition = Prisma.sql`${Prisma.raw(monthColumn)} = ${params[params.length - 2]} AND ${Prisma.raw(dayColumn)} = ${params[params.length - 1]}`;
        const baseFallbackCondition = Prisma.sql`MONTH(${Prisma.raw(dateColumn)}) = ${params[params.length - 2]} AND DAY(${Prisma.raw(dateColumn)}) = ${params[params.length - 1]}`;

        if (targetMonth === 2 && targetDay === 29 && !targetDate.isInLeapYear) {
            params.push(2, 28, 3, 1);
            return Prisma.sql`(
        (
          ${Prisma.raw(monthColumn)} IS NOT NULL AND
          ${Prisma.raw(dayColumn)} IS NOT NULL AND
          ${Prisma.raw(yearColumn)} IS NOT NULL AND
          ((${Prisma.raw(monthColumn)} = ${params[params.length - 4]} AND ${Prisma.raw(dayColumn)} = ${params[params.length - 3]}) OR
           (${Prisma.raw(monthColumn)} = ${params[params.length - 2]} AND ${Prisma.raw(dayColumn)} = ${params[params.length - 1]}))
        ) OR (
          (
            ${Prisma.raw(monthColumn)} IS NULL OR
            ${Prisma.raw(dayColumn)} IS NULL OR
            ${Prisma.raw(yearColumn)} IS NULL
          ) AND
          ${Prisma.raw(dateColumn)} IS NOT NULL AND
          ((MONTH(${Prisma.raw(dateColumn)}) = ${params[params.length - 4]} AND DAY(${Prisma.raw(dateColumn)}) = ${params[params.length - 3]}) OR
           (MONTH(${Prisma.raw(dateColumn)}) = ${params[params.length - 2]} AND DAY(${Prisma.raw(dateColumn)}) = ${params[params.length - 1]}))
        )
      )`;
        }

        return Prisma.sql`(
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

    /**
     * Builds tag conditions for has_tag and doesnt_have_tag
     */
    private static buildTagConditions(hasTags: string[], doesntHaveTags: string[], params: any[]): Prisma.Sql[] {
        const tagConditions: Prisma.Sql[] = [];

        hasTags.forEach(tagId => {
            params.push(BigInt(tagId));
            tagConditions.push(
                Prisma.sql`EXISTS (
          SELECT 1 FROM contact_tags ct
          WHERE ct.contact_id = contacts.id
          AND ct.tag_id = ${params[params.length - 1]}
        )`,
            );
        });

        doesntHaveTags.forEach(tagId => {
            params.push(BigInt(tagId));
            tagConditions.push(
                Prisma.sql`NOT EXISTS (
          SELECT 1 FROM contact_tags ct
          WHERE ct.contact_id = contacts.id
          AND ct.tag_id = ${params[params.length - 1]}
        )`,
            );
        });

        return tagConditions;
    }

    /**
     * Builds 30-minute window for on_day filter
     */
    private static buildOnDayWindow(onDay: string, params: any[]): { windowStart: Date; windowEnd: Date } {
        const [hours, minutes] = onDay.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
            throw new BadRequestException(`Invalid on_day time: ${onDay}. Expected HH:MM`);
        }

        const targetTime = DateTime.now().toUTC().set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        if (!targetTime.isValid) {
            throw new BadRequestException(`Invalid UTC target time: ${onDay}`);
        }

        return {
            windowStart: targetTime.minus({ minutes: 30 }).toJSDate(),
            windowEnd: targetTime.plus({ minutes: 30 }).toJSDate(),
        };
    }

    /**
     * Converts month name to number
     */
    private static getMonthNumber(value: string | number): number {
        if (typeof value === 'number') return value;

        const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        };

        const monthNum = monthMap[String(value).toLowerCase().trim()];
        if (!monthNum) throw new BadRequestException(`Invalid month name: ${value}`);
        return monthNum;
    }
}