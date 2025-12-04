import { Injectable } from '@nestjs/common';
import { AgencyStatus, User, UserStatus, TriggerStatus, TriggerEventConfig, TriggerQueueStatus, Prisma, type Contact } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { RoleDTO } from '../../../utils/RoleDTO';
import { FilterConfigDto } from '../dto/update-trigger-with-configs.dto';
import { EventKeys } from '../../../types/triggers/index';
import { TRIGGER_FILTER_FIELDS, TRIGGER_FILTER_OPERATORS } from '../constants/trigger.constant';
import { getContactDisplayName } from '@/utils/contact';

@Injectable()
export class CronTriggerProcessService {
    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService,
    ) {
        this.logger.setContext(this.constructor.name);
    }

    async processCronTrigger() {

        this.logger.info('Corn Trigger Process Service Started');

        const activeAgencies = await this.prisma.agency.findMany({
            where: {
                status: AgencyStatus.ACTIVE
            },
            select: { id: true }
        });

        console.log('activeAgencies===: ', activeAgencies.length);

        for (const agency of activeAgencies) {
            this.logger.info(`Processing cron triggers for agency ID: ${agency.id}`);
            this.handleAgencyCronTriggers(Number(agency.id));
        }

        this.logger.info('Corn Trigger Process Service Completed');

    }

    async handleAgencyCronTriggers(agencyId: number) {

        this.logger.info(`Handling cron triggers for agency ID: ${agencyId}`);
        // Implement the logic to handle cron triggers for the given agency

        const activeUsers = await this.prisma.user.findMany({
            where: {
                agencyId: agencyId, // Replace with the actual agency ID        
                status: UserStatus.ACTIVE,
                role: {
                    name: RoleDTO.ADMIN_ROLE_NAME
                },
            },
            select: { id: true }
        });

        console.log(`Active users for agency ${agencyId}: `, activeUsers.length);

        for (const activeUser of activeUsers) {

            this.logger.info(`Processing cron triggers for user ID: ${activeUser.id} in agency ID: ${agencyId}`);

            const user = await this.prisma.user.findUnique({
                where: { id: Number(activeUser.id) }
            });
            if (user) {
                await this.handleUserCronTriggers(user);
            } else {
                this.logger.warn(`User with ID ${activeUser.id} not found.`);
            }
        }

    }

    async handleUserCronTriggers(user: User) {

        this.logger.info(`Handling cron triggers for user ID: ${user.id} in agency ID: ${user.agencyId}`);

        await this.handleBrithdayTriggers(user);

        await this.handleAnniversaryTriggers(user);

    }

    async handleBrithdayTriggers(user: User) {
        // Implement the logic to handle birthday triggers
        // Implement the logic to handle cron triggers for the given user
        const triggerEventConfigs = await this.prisma.triggerEventConfig.findMany({
            where: {
                agencyId: user.agencyId,
                userId: user.id,
                trigger: {
                    status: TriggerStatus.ACTIVE,
                },
                event: {
                    key: EventKeys.BIRTHDAY,
                },
            },
            include: {
                event: {
                    select: {
                        key: true,
                    },
                },
            }
        });

        console.log(`Active BrithdayTriggers for user ${user.id}: `, triggerEventConfigs.length);

        if (triggerEventConfigs.length === 0) {
            this.logger.info(`No active birthday trigger event configurations found for user ID: ${user.id}`);
            return;
        }


        for (const triggerEventConfig of triggerEventConfigs) {

            this.logger.info(`Processing cron trigger ID: ${triggerEventConfig.id} for user ID: ${user.id}`);

            const filterConfigDtos: FilterConfigDto[] = await this.parseTriggerEventFilters(triggerEventConfig);

            console.log('Filter Configs: ', filterConfigDtos);

            const whereClause = await this.buildCombinedFilterWhereClause(triggerEventConfig, filterConfigDtos, EventKeys.BIRTHDAY);

            console.log('whereClause: ', whereClause);

            const birthdayContacts = await this.findBirthdayContacts(user, triggerEventConfig.triggerId, triggerEventConfig.id, whereClause);

            this.logger.info(`Birthday contacts for cron trigger ID: ${triggerEventConfig.id} for user ID: ${user.id}: `, birthdayContacts.length);

            if (birthdayContacts.length === 0) {
                this.logger.info(`No contacts with birthdays today for user ID: ${user.id}`);
                continue;
            }

            // Get scheduleAt from filters
            const scheduleAt = await this.getScheduleDateFromFilters(triggerEventConfig, filterConfigDtos);


            // Implement the logic to process each trigger
            for (const contact of birthdayContacts) {

                const alreadyExcuted = await this.prisma.cacheTriggerEventQueue.findFirst({
                    where: {
                        agencyId: user.agencyId,
                        userId: user.id,
                        triggerId: triggerEventConfig.triggerId,
                        triggerEventId: triggerEventConfig.triggerEventId,
                        triggerEventType: triggerEventConfig.event.key,
                        triggerEventConfigId: triggerEventConfig.id,
                        contactId: Number(contact.id)
                    },
                    select: { id: true }
                });

                this.logger.info('alreadyExcuted: ', alreadyExcuted);

                if (alreadyExcuted) {
                    this.logger.info(`Skipping contact ID: ${contact.id} for cron trigger ID: ${triggerEventConfig.id} as it has already been processed.`);
                    continue; // Skip to the next contact
                }

                // Merge default payload with provided payload
                const finalPayload = {
                    contactId: contact.id,
                    userId: user.id,
                    agencyId: user.agencyId,
                    eventKey: triggerEventConfig.event.key as EventKeys,
                    contact: { displayName: getContactDisplayName(contact as Contact), number: contact.number },
                };
                const cacheTriggerQueue = await this.prisma.cacheTriggerEventQueue.create({
                    data: {
                        agencyId: user.agencyId,
                        userId: user.parentUserId || user.id,
                        triggerId: triggerEventConfig.triggerId,
                        triggerEventId: triggerEventConfig.triggerEventId,
                        triggerEventType: triggerEventConfig.event.key,
                        triggerEventConfigId: triggerEventConfig.id,
                        contactId: Number(contact.id),
                        status: TriggerQueueStatus.PENDING,
                        scheduleAt,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        payload: JSON.stringify(finalPayload),
                    }
                });
                this.logger.info(`Created trigger queue ID: ${cacheTriggerQueue.id} for cron trigger ID: ${triggerEventConfig.id}`);
            }

        }

    }

    async handleAnniversaryTriggers(user: User) {

        // Implement the logic to handle cron triggers for the given user
        const triggerEventConfigs = await this.prisma.triggerEventConfig.findMany({
            where: {
                agencyId: user.agencyId,
                userId: user.id,
                trigger: {
                    status: TriggerStatus.ACTIVE,
                },
                event: {
                    key: EventKeys.ANNIVERSARY,
                },
            },
            include: {
                event: {
                    select: {
                        key: true,
                    },
                },
            }
        });

        console.log(`Active triggerEventConfigs for user ${user.id}: `, triggerEventConfigs.length);

        if (triggerEventConfigs.length === 0) {
            this.logger.info(`No active anniversary trigger event configurations found for user ID: ${user.id}`);
            return;
        }

        for (const triggerEventConfig of triggerEventConfigs) {

            this.logger.info(`Processing cron trigger ID: ${triggerEventConfig.id} for user ID: ${user.id}`);

            const filterConfigDtos: FilterConfigDto[] = await this.parseTriggerEventFilters(triggerEventConfig);

            console.log('Filter Configs: ', filterConfigDtos);

            const whereClause = await this.buildCombinedFilterWhereClause(triggerEventConfig, filterConfigDtos, EventKeys.ANNIVERSARY);

            console.log('whereClause: ', whereClause);

            const anniversaryContacts = await this.findAnniversaryContacts(user, triggerEventConfig.triggerId, triggerEventConfig.id, whereClause);

            this.logger.info(`Anniversary contacts for cron trigger ID: ${triggerEventConfig.id} for user ID: ${user.id}: `, anniversaryContacts.length);

            if (anniversaryContacts.length === 0) {
                this.logger.info(`No contacts with anniversaries today for user ID: ${user.id}`);
                continue;
            }


            // Get scheduleAt from filters
            const scheduleAt = await this.getScheduleDateFromFilters(triggerEventConfig, filterConfigDtos);

            // Implement the logic to process each trigger
            for (const contact of anniversaryContacts) {

                const alreadyExcuted = await this.prisma.cacheTriggerEventQueue.findFirst({
                    where: {
                        agencyId: user.agencyId,
                        userId: user.id,
                        triggerId: triggerEventConfig.triggerId,
                        triggerEventId: triggerEventConfig.triggerEventId,
                        triggerEventType: triggerEventConfig.event.key,
                        triggerEventConfigId: triggerEventConfig.id,
                        contactId: Number(contact.id)
                    },
                    select: { id: true }
                });

                this.logger.info('alreadyExcuted: ', alreadyExcuted);

                if (alreadyExcuted) {
                    this.logger.info(`Skipping contact ID: ${contact.id} for cron trigger ID: ${triggerEventConfig.id} as it has already been processed.`);
                    continue; // Skip to the next contact
                }

                // Merge default payload with provided payload
                const finalPayload = {
                    contactId: contact.id,
                    userId: user.id,
                    agencyId: user.agencyId,
                    eventKey: triggerEventConfig.event.key as EventKeys,
                    contact: { displayName: getContactDisplayName(contact as Contact), number: contact.number },
                };

                const cacheTriggerQueue = await this.prisma.cacheTriggerEventQueue.create({
                    data: {
                        agencyId: user.agencyId,
                        userId: user.parentUserId || user.id,
                        triggerId: triggerEventConfig.triggerId,
                        triggerEventId: triggerEventConfig.triggerEventId,
                        triggerEventType: triggerEventConfig.event.key,
                        triggerEventConfigId: triggerEventConfig.id,
                        contactId: Number(contact.id),
                        status: TriggerQueueStatus.PENDING,
                        scheduleAt,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        payload: JSON.stringify(finalPayload)
                    }
                });

                this.logger.info(`Created trigger queue ID: ${cacheTriggerQueue.id} for cron trigger ID: ${triggerEventConfig.id}`);

            }
        }

    }


    // New helper: Extract scheduleDate if ON_DAY or applicable filter present

    private async getScheduleDateFromFilters(
        triggerEventConfig: TriggerEventConfig,
        filters: FilterConfigDto[],
    ): Promise<Date> {

        if (!filters?.length) return new Date();

        for (const filter of filters) {
            const field = filter.field?.toLowerCase();
            const value = filter.value?.toString().trim();

            if (field === TRIGGER_FILTER_FIELDS.ON_DAY && value) {
                // 🕒 Expected format: "HH:mm"
                if (/^\d{1,2}:\d{2}$/.test(value)) {

                    const [hour, minute] = value.split(":").map(Number);

                    const now = new Date();
                    now.setHours(hour, minute, 0, 0);

                    return now;

                }

                // fallback → current time in user’s timezone
                return new Date();
            }
        }

        // Default → system current time
        return new Date();
    }

    // Method 1: Find Contact IDs with birthday
    async findBirthdayContacts(
        user: User,
        triggerId: bigint,
        triggerEventConfigId: bigint,
        whereClause: string
    ): Promise<{ id: bigint, number: string, firstName: string, lastName: string }[]> {

        console.log('whereClause: ', whereClause);

        const query = Prisma.sql`
                                SELECT c.id, c.number, c.first_name as firstName, c.last_name as lastName
                                FROM contacts c
                                LEFT JOIN cache_trigger_event_queues q
                                    ON q.contact_id = c.id
                                    AND q.trigger_event_config_id = ${triggerEventConfigId}
                                    AND q.trigger_id = ${triggerId}
                                    AND q.agency_id = c.agency_id
                                    AND q.user_id = c.user_id
                                WHERE c.agency_id = ${user.agencyId}
                                    AND c.user_id = ${user.id}
                                    AND ${Prisma.raw(whereClause)}
                                    AND q.contact_id IS NULL;
                                `;

        console.log('query: ', query.sql);

        const contacts = await this.prisma.$queryRaw<{ id: bigint, number: string, firstName: string, lastName: string }[]>(query);

        console.log('contacts count: ', contacts.length);

        return contacts
    }


    // Method 2: Find Contact IDs with anniversary today
    async findAnniversaryContacts(
        user: User,
        triggerId: bigint,
        triggerEventConfigId: bigint,
        whereClause: string
    ): Promise<{ id: bigint, number: string, firstName: string, lastName: string }[]> {

        console.log('whereClause: ', whereClause);

        const query = Prisma.sql`
                                SELECT c.id, c.number, c.first_name as firstName, c.last_name as lastName
                                FROM contacts c
                                LEFT JOIN cache_trigger_event_queues q
                                    ON q.contact_id = c.id
                                    AND q.trigger_event_config_id = ${triggerEventConfigId}
                                    AND q.trigger_id = ${triggerId}
                                    AND q.agency_id = c.agency_id
                                    AND q.user_id = c.user_id
                                WHERE c.agency_id = ${user.agencyId}
                                    AND c.user_id = ${user.id}
                                    AND ${Prisma.raw(whereClause)}
                                    AND q.contact_id IS NULL;
                                `;

        console.log('query: ', query.sql);

        const contacts = await this.prisma.$queryRaw<{ id: bigint, number: string, firstName: string, lastName: string }[]>(query);

        console.log('contacts count: ', contacts.length);

        return contacts

    }

    async parseTriggerEventFilters(triggerEventConfig: TriggerEventConfig): Promise<FilterConfigDto[]> {

        // Safely extract and validate filters from triggerEventConfig
        let filterConfigDtos: FilterConfigDto[] = [];

        if (triggerEventConfig.filters) {

            try {
                // Parse filters (Json? type could be a string or object)
                const filters = typeof triggerEventConfig.filters === 'string'
                    ? JSON.parse(triggerEventConfig.filters)
                    : triggerEventConfig.filters;

                console.log('filters: ', filters);

                // Handle both single object and array cases
                const filtersArray = Array.isArray(filters) ? filters : [filters];

                console.log('filtersArray: ', filtersArray);

                // Map and validate filters to FilterConfigDto
                filterConfigDtos = filtersArray.map((filter) => {
                    const filterConfig = new FilterConfigDto();
                    filterConfig.field = filter.field;
                    filterConfig.operator = filter.operator;
                    filterConfig.value = filter.value;

                    // Optional: Validate the filterConfig using class-validator
                    // You can use `validateSync` from class-validator to ensure the structure
                    // Example:
                    // const errors = validateSync(filterConfig);
                    // if (errors.length > 0) {
                    //   throw new Error(`Invalid filter configuration: ${JSON.stringify(errors)}`);
                    // }

                    return filterConfig;
                });

                // this.logger.info('Filter Configs: ', filterConfigDtos);
            } catch (error) {
                this.logger.error('Failed to parse or process filters', error);
                // Handle the error as needed (e.g., throw an exception or set default)
                filterConfigDtos = [];
            }

        } else {
            this.logger.warn('No filters found in triggerEventConfig');
        }

        // console.log('filterConfigDtos: ', filterConfigDtos);

        // Use filterConfigDtos as needed
        return filterConfigDtos;
    }

    async buildCombinedFilterWhereClause(
        triggerEventConfig: TriggerEventConfig,
        filters: FilterConfigDto[],
        triggerType: EventKeys.ANNIVERSARY | EventKeys.BIRTHDAY
    ): Promise<string> {

        if (!filters?.length) return '1=1'; // no filters, always true

        const parts = await Promise.all(filters.map((f) => this.buildFilterCondition(triggerEventConfig, f, triggerType)));

        const whereClause = parts.length ? parts.join(' AND ') : '1=1';

        // console.log('whereClause: ', whereClause);

        return whereClause;

    }


    async buildFilterCondition(
        triggerEventConfig: TriggerEventConfig,
        filter: FilterConfigDto,
        triggerType: EventKeys.ANNIVERSARY | EventKeys.BIRTHDAY
    ): Promise<string> {

        const prefix = triggerType === EventKeys.BIRTHDAY ? 'birth' : 'anniversary';
        const today = new Date();

        console.log('prefix: ', prefix);

        switch (filter.field) {

            case TRIGGER_FILTER_FIELDS.MONTH:
                console.log('filter.value: ', filter.value);
                const monthNumber = await this.getMonthNumber(filter.value);
                console.log('monthNumber: ', monthNumber);
                return `c.${prefix}_month ${filter.operator === TRIGGER_FILTER_OPERATORS.NOT_EQUALS ? '!=' : '='} ${monthNumber}`;

            case TRIGGER_FILTER_FIELDS.DAY:
                return `c.${prefix}_day ${filter.operator === TRIGGER_FILTER_OPERATORS.NOT_EQUALS ? '!=' : '='} ${Number(filter.value)}`;

            case TRIGGER_FILTER_FIELDS.BEFORE_DAYS: {
                const days = Number(filter.value);
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + days); // birthday N days from now

                const targetMonth = targetDate.getMonth() + 1;
                const targetDay = targetDate.getDate();

                return `(c.${prefix}_month = ${targetMonth} AND c.${prefix}_day = ${targetDay})`;
            }

            case TRIGGER_FILTER_FIELDS.AFTER_DAYS: {
                const days = Number(filter.value);
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() - days); // birthday N days ago

                const targetMonth = targetDate.getMonth() + 1;
                const targetDay = targetDate.getDate();

                return `(c.${prefix}_month = ${targetMonth} AND c.${prefix}_day = ${targetDay})`;
            }

            case TRIGGER_FILTER_FIELDS.ON_DAY: {
                const targetDate = new Date();
                return `(c.${prefix}_month = ${targetDate.getMonth() + 1} AND c.${prefix}_day = ${targetDate.getDate()})`;
            }

            case TRIGGER_FILTER_FIELDS.HAS_TAG:
            case TRIGGER_FILTER_FIELDS.DOESNT_HAVE_TAG:


                console.log('filter.value: ', filter.value);
                console.log('filter.operator: ', filter.operator);
                // Validate operator
                if (filter.operator !== TRIGGER_FILTER_OPERATORS.HAS && filter.operator !== 'has' &&
                    filter.operator !== TRIGGER_FILTER_OPERATORS.NOT_HAS && filter.operator !== 'not_has') {
                    throw new Error(`Unsupported operator for TAG filter: ${filter.operator}`);
                }

                // Handle filter.value as an array of tag IDs
                const tagIds = Array.isArray(filter.value)
                    ? filter.value.map(id => Number(id)).filter(id => !isNaN(id))
                    : [Number(filter.value)].filter(id => !isNaN(id));

                console.log('tagIds: ', tagIds);

                if (tagIds.length === 0) {
                    throw new Error(`Invalid or empty tag IDs provided for ${filter.operator} filter`);
                }

                const tagQuery = (filter.operator === TRIGGER_FILTER_OPERATORS.HAS)
                    ? `EXISTS (
                        SELECT 1 FROM contact_tags t
                        WHERE t.agency_id = ${triggerEventConfig.agencyId}
                            AND t.user_id = ${triggerEventConfig.userId}
                            AND t.contact_id = c.id
                            AND t.tag_id IN (${tagIds.join(', ')})
                        )`
                    : `NOT EXISTS (
                        SELECT 1 FROM contact_tags t
                        WHERE t.agency_id = ${triggerEventConfig.agencyId} 
                            AND t.user_id = ${triggerEventConfig.userId}
                            AND t.contact_id = c.id
                            AND t.tag_id IN (${tagIds.join(', ')})
                        )`;

                // console.log('tagQuery: ', tagQuery);
                return tagQuery;

            default:
                throw new Error(`Unsupported filter field: ${filter.field}`);
        }
    }

    async getMonthNumber(value: string | number): Promise<number> {

        if (typeof value === 'number') return value;

        const monthMap: Record<string, number> = {
            january: 1,
            february: 2,
            march: 3,
            april: 4,
            may: 5,
            june: 6,
            july: 7,
            august: 8,
            september: 9,
            october: 10,
            november: 11,
            december: 12,
        };

        const monthNum = monthMap[value.toString().toLowerCase().trim()];

        if (!monthNum) throw new Error(`Invalid month name: ${value}`);

        return monthNum;
    }




}
