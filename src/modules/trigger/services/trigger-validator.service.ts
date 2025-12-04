// src/services/trigger-validator.service.ts
import { Injectable } from '@nestjs/common';
import { CacheTriggerEventQueue } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { DateTime } from 'luxon';
import { FilterConditionDto } from '../dto/process-trigger.dto';
import { EventKeys } from '../../../types/triggers/index';
import { TRIGGER_FILTER_FIELDS, TRIGGER_FILTER_OPERATORS, MATCH_CONDITION_OPTIONS, TRIGGER_EVENT_CONTACT_ACTIONS } from '../constants/trigger.constant';
import { TriggerUtils } from '../utils/trigger.utils';
import type { TriggerValidatorCacheQueuePayload } from 'src/types/triggers/trigger-validator';
import { log } from 'console';



/**
 * Service to handle validation logic for trigger events.
 * Provides methods to validate BIRTHDAY, ANNIVERSARY, KEYWORD, and CONTACT_ADDED triggers.
 */
@Injectable()
export class TriggerValidatorService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService,
    ) {
        this.logger.setContext(this.constructor.name);
    }

    /**
     * Validates a trigger queue based on its event type and filters.
     * @param cacheTriggerEventQueue - The trigger queue entry
     * @param eventKey - The event type key (e.g., BIRTHDAY, KEYWORD)
     * @param filters - Array of filter conditions to validate
     * @returns Promise<boolean> - True if all filters pass, false otherwise
     */
    async validateTrigger(
        cacheTriggerEventQueue: CacheTriggerEventQueue,
        eventKey: string,
        filters: FilterConditionDto[],
    ): Promise<{ success: boolean, errorMessage: string }> {
        this.logger.info(`Validating trigger queue ${cacheTriggerEventQueue.id} for event ${eventKey}`);
        let success = true;
        let errorMessage = '';
        if (!filters || filters.length === 0) {
            this.logger.debug('No filters provided, validation passes');
            errorMessage = 'No filters provided, validation passes';
            return { success, errorMessage };
        }

        switch (eventKey) {
            case EventKeys.BIRTHDAY:
                return await this.validateBirthdayTrigger(cacheTriggerEventQueue, filters);
            case EventKeys.ANNIVERSARY:
                return await this.validateAnniversaryTrigger(cacheTriggerEventQueue, filters);
            case EventKeys.KEYWORD:
                return this.validateKeywordTrigger(cacheTriggerEventQueue, filters);
            case EventKeys.CONTACT_ADDED:
                return this.validateContactAddedUpdatedTrigger(cacheTriggerEventQueue, filters);
            case EventKeys.CONTACT_TAG: // Add new case
                return this.validateContactTagTrigger(cacheTriggerEventQueue, filters);
            case EventKeys.CONTACT_ADDED_TO_BROADCAST:
                return this.validateContactAddedToBroadcastTrigger(cacheTriggerEventQueue, filters);
            default:
                this.logger.warn(`Unknown event key: ${eventKey}`);
                errorMessage = 'No filters provided, validation passes';
                success = false;
                return { success, errorMessage };
        }
    }



    /**
     * Fetches contact tag IDs for tag-based filter validation.
     * @param contactId - The ID of the contact
     * @returns Promise<string[]> - Array of tag IDs as strings
     */
    private async getContactTagIds(contactId: bigint): Promise<string[]> {
        const contactTags = await this.prisma.contactTag.findMany({
            where: { contactId },
            select: { tagId: true },
        });
        return contactTags.map((ct) => ct.tagId.toString());
    }

    /**
     * Validates a BIRTHDAY trigger by checking contact's birth date and filters.
     * @param cacheTriggerEventQueue - The trigger queue entry
     * @param filters - Array of filter conditions
     * @returns Promise<boolean> - True if all filters pass
     */
    async validateBirthdayTrigger(cacheTriggerEventQueue: CacheTriggerEventQueue, filters: FilterConditionDto[]): Promise<{ success: boolean, errorMessage: string }> {
        let success = false;
        let errorMessage = '';

        if (!cacheTriggerEventQueue.contactId) {
            this.logger.debug(`No contactId in queue ${cacheTriggerEventQueue.id}`);
            errorMessage = `No contactId in queue ${cacheTriggerEventQueue.id}`;
            return { success, errorMessage };
        }

        const contact = await this.prisma.contact.findUnique({
            where: { id: cacheTriggerEventQueue.contactId },
            select: { birthDate: true },
        });

        if (!contact?.birthDate) {
            this.logger.debug(`No birthDate for contact ${cacheTriggerEventQueue.contactId}`);
            errorMessage = `No birthDate for contact ${cacheTriggerEventQueue.contactId}`;
            return { success, errorMessage };
        }

        const birthDate = DateTime.fromJSDate(contact.birthDate).toUTC().startOf('day');
        if (!birthDate.isValid) {
            this.logger.debug(`Invalid birthDate for contact ${cacheTriggerEventQueue.contactId}`);
            errorMessage = `Invalid birthDate for contact ${cacheTriggerEventQueue.contactId}`;
            return { success, errorMessage };
        }

        return this.validateDateBasedTrigger(birthDate, cacheTriggerEventQueue, filters, 'Birthday');
    }

    /**
     * Validates an ANNIVERSARY trigger by checking contact's anniversary date and filters.
     * @param cacheTriggerEventQueue - The trigger queue entry
     * @param filters - Array of filter conditions
     * @returns Promise<boolean> - True if all filters pass
     */
    async validateAnniversaryTrigger(cacheTriggerEventQueue: CacheTriggerEventQueue, filters: FilterConditionDto[]): Promise<{ success: boolean, errorMessage: string }> {
        let success = false;
        let errorMessage = '';

        if (!cacheTriggerEventQueue.contactId) {
            this.logger.debug(`No contactId in queue ${cacheTriggerEventQueue.id}`);
            success = false;
            errorMessage = `No contactId in queue ${cacheTriggerEventQueue.id}`;
            return { success, errorMessage };
        }

        const contact = await this.prisma.contact.findUnique({
            where: { id: cacheTriggerEventQueue.contactId },
            select: { anniversaryDate: true },
        });

        if (!contact?.anniversaryDate) {
            this.logger.debug(`No anniversaryDate for contact ${cacheTriggerEventQueue.contactId}`);
            errorMessage = `No anniversaryDate for contact ${cacheTriggerEventQueue.contactId}`;
            return { success, errorMessage };
        }

        const annivDate = DateTime.fromJSDate(contact.anniversaryDate).toUTC().startOf('day');
        if (!annivDate.isValid) {
            this.logger.debug(`Invalid anniversaryDate for contact ${cacheTriggerEventQueue.contactId}`);
            errorMessage = `Invalid anniversaryDate for contact ${cacheTriggerEventQueue.contactId}`;
            return { success, errorMessage };
        }

        return this.validateDateBasedTrigger(annivDate, cacheTriggerEventQueue, filters, 'Anniversary');
    }

    /**
     * Validates date-based triggers (BIRTHDAY or ANNIVERSARY) using dynamic filter checks.
     * Matches on_day check with 30-minute window only when specified and date matches.
     * @param eventDate - The contact's event date (birth or anniversary)
     * @param cacheTriggerEventQueue - The trigger queue entry
     * @param filters - Array of filter conditions
     * @param eventName - Event name for logging (e.g., 'Birthday')
     * @returns Promise<boolean> - True if all filters pass
     */
    private async validateDateBasedTrigger(
        eventDate: DateTime,
        cacheTriggerEventQueue: CacheTriggerEventQueue,
        filters: FilterConditionDto[],
        eventName: string,
    ): Promise<{ success: boolean, errorMessage: string }> {

        let success = false;
        let errorMessage = '';
        const now = DateTime.now().toUTC().startOf('day');
        const contactMonth = eventDate.month;
        const contactDay = eventDate.day;
        let tagIds: string[] = [];

        // Compute delta for before/after filters
        let eventThisYear = eventDate.set({ year: now.year }).startOf('day');
        let diffDays = eventThisYear.diff(now, 'days').days;
        const isOnDay = diffDays === 0;
        const isBefore = diffDays > 0;
        const isAfter = diffDays < 0;
        if (isAfter) {
            diffDays = -diffDays; // Absolute for comparison
        }

        // Fetch tags for has_tag/doesnt_have_tag only if the filter is present
        if (filters.some((f) => f.field === TRIGGER_FILTER_FIELDS.HAS_TAG || f.field === TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG)) {
            tagIds = await this.getContactTagIds(cacheTriggerEventQueue.contactId);
        }

        for (const filter of filters) {
            const { field, operator, value } = filter;
            let valid = true;

            switch (field) {
                case TRIGGER_FILTER_FIELDS.MONTH:
                    if (operator === TRIGGER_FILTER_OPERATORS.EQUALS) {
                        valid = TriggerUtils.getMonthNumber(value) === contactMonth;
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.DAY:
                    if (operator === TRIGGER_FILTER_OPERATORS.EQUALS) {
                        const dayVal = parseInt(value, 10);
                        valid = !isNaN(dayVal) && dayVal >= 1 && dayVal <= 31 && dayVal === contactDay;
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.BEFORE_DAYS:
                    if (operator === TRIGGER_FILTER_OPERATORS.BEFORE) {
                        const days = parseInt(value, 10);
                        valid = !isNaN(days) && days >= 0 && days <= 365 && isBefore && days === Math.floor(diffDays);
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.AFTER_DAYS:
                    if (operator === TRIGGER_FILTER_OPERATORS.AFTER) {
                        const days = parseInt(value, 10);
                        valid = !isNaN(days) && days >= 0 && days <= 365 && isAfter && days === Math.floor(diffDays);
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.ON_DAY:
                    if (operator === TRIGGER_FILTER_OPERATORS.EQUALS && isOnDay) {
                        valid = TriggerUtils.isCurrentTimeMatching(value);
                    } else {
                        valid = isOnDay; // Only check time if on_day matches today
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.HAS_TAG:
                    if (operator === TRIGGER_FILTER_OPERATORS.HAS) {
                        valid = tagIds.includes(value);
                    }
                    break;

                case TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG:
                    if (operator === TRIGGER_FILTER_OPERATORS.NOT_HAS) {
                        valid = !tagIds.includes(value);
                    }
                    break;

                default:
                    this.logger.warn(`Unhandled filter field ${field} for ${eventName} queue ${cacheTriggerEventQueue.id}`);
                    valid = false;
            }

            if (!valid) {
                this.logger.debug(`Filter failed: ${field}=${value} for ${eventName} queue ${cacheTriggerEventQueue.id}`);
                errorMessage = `Filter failed: ${field}=${value} for ${eventName} queue ${cacheTriggerEventQueue.id}`;
                return { success, errorMessage };
            }
        }

        success = true;
        return { success, errorMessage };
    }

    /**
     * Validates a KEYWORD trigger by checking if the message matches the keyword and match condition.
     * @param cacheTriggerEventQueue - The trigger queue entry
     * @param filters - Array of filter conditions
     * @returns boolean - True if all filters pass
     */
    async validateKeywordTrigger(cacheTriggerEventQueue: CacheTriggerEventQueue, filters: FilterConditionDto[]): Promise<{ success: boolean, errorMessage: string }> {

        const payload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventQueue.payload as any);

        console.log("payload: ", payload);
        let success = false;
        let errorMessage = '';
        const message = payload?.message?.toLowerCase();
        console.log("payload.message>...", payload?.message);
        console.log("message>...", message);
        if (!message) {
            this.logger.debug(`No message in payload for queue ${cacheTriggerEventQueue.id}`);
            console.log(`Missing or invalid required filters for KEYWORD in queue ${cacheTriggerEventQueue.id}`);
            return { success, errorMessage };
        }

        const keywordFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.KEYWORD);
        const matchCondFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.MATCH_CONDITION);
        console.log("keywordFilter: ", keywordFilter);
        console.log("matchCondFilter: ", matchCondFilter);
        if (
            !keywordFilter ||
            !matchCondFilter ||
            keywordFilter.operator !== TRIGGER_FILTER_OPERATORS.CUSTOM ||
            matchCondFilter.operator !== TRIGGER_FILTER_OPERATORS.EQUALS) {
            this.logger.info(`Missing or invalid required filters for KEYWORD in queue ${cacheTriggerEventQueue.id}`);
            console.log(`Missing or invalid required filters for KEYWORD in queue ${cacheTriggerEventQueue.id}`);
            return { success, errorMessage };
        }

        const keyword = keywordFilter.value.toLowerCase();
        const matchType = matchCondFilter.value as keyof typeof MATCH_CONDITION_OPTIONS;

        let matches: boolean = false;
        switch (matchType) {
            case MATCH_CONDITION_OPTIONS.EXACT:
                matches = message === keyword;
                errorMessage = matches ? '' : `message doesn't match with ${keyword}`;
                break;
            case MATCH_CONDITION_OPTIONS.CONTAINS:
                matches = message.includes(keyword);
                errorMessage = matches ? '' : `keyward on contains on message ${keyword}`;
                break;
            case MATCH_CONDITION_OPTIONS.STARTS_WITH:
                matches = message.startsWith(keyword);
                errorMessage = matches ? '' : `message not start with ${keyword}`;
                break;
            case MATCH_CONDITION_OPTIONS.ENDS_WITH:
                matches = message.endsWith(keyword);
                errorMessage = matches ? '' : `message not end with ${keyword}`;
                break;
            default:
                this.logger.debug(`Invalid match type ${matchType} for queue ${cacheTriggerEventQueue.id}`);
                return { success, errorMessage };
        }

        success = matches;
        console.log("errorMessage:", errorMessage);
        return { success, errorMessage };
    }

    /**
   * Validates a CONTACT_ADDED trigger by checking action and updated fields.
   * @param cacheTriggerEventQueue - The trigger queue entry
   * @param filters - Array of filter conditions
   * @returns { success: boolean, errorMessage: string }
   */
    async validateContactAddedUpdatedTrigger(
        cacheTriggerEventQueue: CacheTriggerEventQueue,
        filters: FilterConditionDto[],
    ): Promise<{ success: boolean; errorMessage: string }> {
        const payload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventQueue.payload as any)

        let success = false;
        let errorMessage = '';

        // 🚨 Missing payload action
        // if (!payload?.action) {
        //     errorMessage = `No action in payload for queue ${cacheTriggerEventQueue.id}`;
        //     this.logger.debug(errorMessage);
        //     return { success, errorMessage };
        // }

        // // 🧩 Validate action filter
        // const actionFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.ACTION);

        // if (
        //     !actionFilter ||
        //     actionFilter.operator !== TRIGGER_FILTER_OPERATORS.EQUALS ||
        //     actionFilter.value !== payload.action
        // ) {
        //     errorMessage = `Action mismatch for queue ${cacheTriggerEventQueue.id}: expected ${actionFilter?.value}, got ${payload.action}`;
        //     this.logger.debug(errorMessage);
        //     return { success, errorMessage };
        // }

        // // 🧠 Validate updated fields only when action === UPDATED
        // if (payload.action === TRIGGER_EVENT_CONTACT_ACTIONS.UPDATED) {
        //     const updatedFieldFilters = filters.filter(
        //         (f) => f.field === TRIGGER_FILTER_FIELDS.UPDATED_FIELDS,
        //     );

        //     if (updatedFieldFilters.length > 0) {
        //         const updatedFields = payload.updatedFields || [];

        //         // Flatten filter values (each can be string or array)
        //         const filterFieldValues = updatedFieldFilters.flatMap((f) =>
        //             Array.isArray(f.value) ? f.value : [f.value],
        //         );

        //         //  Check for at least one matching updated field
        //         const hasMatchingField = updatedFields.some((field) =>
        //             filterFieldValues.includes(field),
        //         );

        //         if (!hasMatchingField) {
        //             errorMessage = `No matching updated fields for queue ${cacheTriggerEventQueue.id}. Expected one of: [${filterFieldValues.join(
        //                 ', ',
        //             )}], got: [${updatedFields.join(', ')}]`;
        //             this.logger.debug(errorMessage);
        //             return { success, errorMessage };
        //         }
        //     }
        // }

        success = true;
        return { success, errorMessage };
    }

    /**
     *  Validates a CONTACT_ADDED_TO_BROADCAST trigger by checking the broadcastId in the payload.
     * @param cacheTriggerEventQueue 
     * @param filters 
     * @returns 
     */
    async validateContactAddedToBroadcastTrigger(cacheTriggerEventQueue: CacheTriggerEventQueue, filters: FilterConditionDto[]): Promise<{ success: boolean, errorMessage: string }> {
        let success = false;
        let errorMessage = '';

        const payload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventQueue.payload as any);
        if (!payload?.broadcastId) {
            errorMessage = `Missing broadcastId in payload for queue ${cacheTriggerEventQueue.id}`;
            this.logger.debug(errorMessage);
            return { success, errorMessage };
        }

        const broadcastFilter = filters.find((f) => f.field === TRIGGER_FILTER_FIELDS.BROADCAST_ID);
        if (!broadcastFilter || broadcastFilter.operator !== TRIGGER_FILTER_OPERATORS.EQUALS || broadcastFilter.value !== payload.broadcastId?.toString()) {
            errorMessage = `Broadcast ID mismatch for queue ${cacheTriggerEventQueue.id}: expected ${broadcastFilter?.value}, got ${payload.broadcastId}`;
            this.logger.debug(errorMessage);
            return { success, errorMessage };
        }

        success = true;
        return { success, errorMessage };
    }

    /**
      * Validates a CONTACT_TAG trigger by checking tag added/removed action and filter conditions.
      * @param cacheTriggerEventQueue - The trigger queue entry
      * @param filters - Array of filter conditions
      * @returns Promise<{ success: boolean, errorMessage: string }> - True if all filters pass
      */
    async validateContactTagTrigger(
        cacheTriggerEventQueue: CacheTriggerEventQueue,
        filters: FilterConditionDto[],
    ): Promise<{ success: boolean, errorMessage: string }> {
        let success = false;
        let errorMessage = '';

        const payload = TriggerUtils.parseTriggerCacheQueuePayload(cacheTriggerEventQueue.payload as any);
        if (!payload?.tagId || !payload?.action) {
            errorMessage = `Missing tagId or action in payload for queue ${cacheTriggerEventQueue.id}`;
            this.logger.debug(errorMessage);
            return { success, errorMessage };
        }

        const tagFilter = filters.find(
            (f) =>
                (f.field === TRIGGER_FILTER_FIELDS.TAG_ADDED || f.field === TRIGGER_FILTER_FIELDS.TAG_REMOVED) &&
                f.operator === TRIGGER_FILTER_OPERATORS.EQUALS,
        );

        if (!tagFilter) {
            errorMessage = `Missing required TAG_ADDED or TAG_REMOVED filter for queue ${cacheTriggerEventQueue.id}`;
            this.logger.debug(errorMessage);
            return { success, errorMessage };
        }

        const expectedAction =
            tagFilter.field === TRIGGER_FILTER_FIELDS.TAG_ADDED ? TRIGGER_FILTER_FIELDS.TAG_ADDED : TRIGGER_FILTER_FIELDS.TAG_REMOVED;
        if (payload.action !== expectedAction) {
            errorMessage = `Action mismatch for queue ${cacheTriggerEventQueue.id}: expected ${expectedAction}, got ${payload.action}`;
            this.logger.debug(errorMessage);
            return { success, errorMessage };
        }

        if (tagFilter.value.toString() !== payload.tagId.toString()) {
            errorMessage = `Tag ID mismatch for queue ${cacheTriggerEventQueue.id}: expected ${tagFilter.value}, got ${payload.tagId}`;
            this.logger.debug(errorMessage);
            return { success, errorMessage };
        }

        success = true;
        return { success, errorMessage };
    }
}