import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import type { ContactTriggerEventType } from '@prisma/client';
import { DateTime } from 'luxon';
import { TriggerEventExecutionLogStatus } from '@prisma/client';
import type { EventActionExecutionLogDto, EventExecutionLogDto } from '../dto/trigger-execution-log.dto';
@Injectable()
export class TriggerExecutionLogService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
    ) {
        this.logger.setContext(this.constructor.name);
    }

    /**
  * Log event executions for one or multiple contacts
  */
    async eventExecutionLog({
        triggerId,
        contactId,
        agencyId,
        userId,
        eventKey,
        status = TriggerEventExecutionLogStatus.SUCCESS,
        error,
        executionDate = new Date(),
    }: EventExecutionLogDto): Promise<void> {
        try {
            // Normalize date to remove time component
            const dateOnly = DateTime.fromJSDate(executionDate).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();

            // Convert single contactId to array for consistency
            const contactIds = Array.isArray(contactId) ? contactId : [contactId];

            if (contactIds.length === 0) {
                this.logger.debug(`No contact IDs provided for ${eventKey} event execution`);
                return;
            }

            // Get trigger event config
            const triggerEventConfig = await this.prisma.triggerEventConfig.findFirst({
                where: {
                    triggerId,
                    event: { key: eventKey },
                },
                select: {
                    id: true,
                    triggerEventId: true,
                },
            });

            if (!triggerEventConfig) {
                throw new NotFoundException(`Trigger event config not found for trigger ${triggerId} and event key ${eventKey}`);
            }

            // Prepare bulk insert data
            const executionLogs = contactIds.map((id) => ({
                contactId: id,
                agencyId,
                userId,
                triggerId,
                triggerEventId: triggerEventConfig.triggerEventId,
                triggerEventConfigId: triggerEventConfig.id,
                status,
                error,
                executedAt: dateOnly,
            }));

            // Bulk insert with transaction
            await this.prisma.$transaction([
                this.prisma.triggerEventExecutionLog.createMany({
                    data: executionLogs,
                    skipDuplicates: true,
                }),
            ]);

            this.logger.debug(`Logged ${eventKey} event execution for ${contactIds.length} contacts on ${dateOnly.toISOString()}`);
        } catch (error) {
            if (error.code === 'P2002') {
                this.logger.debug(`Some ${eventKey} event executions already logged for contacts`);
                return;
            }
            this.logger.error(`Failed to log ${eventKey} event execution: ${error.message}`, { error });
            throw new BadRequestException(`Failed to log ${eventKey} event execution: ${error.message}`);
        }
    }

    /**
     * Log action executions for one or multiple contacts
     */
    async eventActionExecutionLog({
        triggerId,
        contactId,
        agencyId,
        userId,
        eventKey,
        actionKey,
        status = TriggerEventExecutionLogStatus.SUCCESS,
        error,
        executionDate = new Date(),
    }: EventActionExecutionLogDto): Promise<void> {
        try {
            // Normalize date to remove time component
            const dateOnly = DateTime.fromJSDate(executionDate).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate();

            // Convert single contactId to array for consistency
            const contactIds = Array.isArray(contactId) ? contactId : [contactId];

            if (contactIds.length === 0) {
                this.logger.debug(`No contact IDs provided for ${eventKey} action ${actionKey} execution`);
                return;
            }

            // Get trigger action config
            const triggerActionConfig = await this.prisma.triggerActionConfig.findFirst({
                where: {
                    triggerId,
                    triggerEventConfig: {
                        event: { key: eventKey },
                    },
                    triggerAction: { key: actionKey },
                },
                select: {
                    id: true,
                    actionId: true,
                    triggerEventConfig: {
                        select: {
                            id: true,
                            triggerEventId: true,
                        },
                    },
                },
            });

            if (!triggerActionConfig) {
                throw new NotFoundException(
                    `Trigger action config not found for trigger ${triggerId}, event ${eventKey}, action ${actionKey}`,
                );
            }

            // Prepare bulk insert data
            const actionExecutionLogs = contactIds.map((id) => ({
                contactId: id,
                agencyId,
                userId,
                triggerId,
                triggerEventId: triggerActionConfig.triggerEventConfig.triggerEventId,
                triggerEventConfigId: triggerActionConfig.triggerEventConfig.id,
                triggerActionId: triggerActionConfig.actionId,
                triggerActionConfigId: triggerActionConfig.id,
                status,
                error,
                executedAt: dateOnly,
            }));

            // Bulk insert with transaction
            await this.prisma.$transaction([
                this.prisma.triggerEventActionExecutionLog.createMany({
                    data: actionExecutionLogs,
                    skipDuplicates: true,
                }),
            ]);

            this.logger.debug(
                `Logged ${eventKey} action execution for ${contactIds.length} contacts, action ${actionKey} on ${dateOnly.toISOString()}`,
            );
        } catch (error) {
            if (error.code === 'P2002') {
                this.logger.debug(`Some ${eventKey} action executions already logged for contacts, action ${actionKey}`);
                return;
            }
            this.logger.error(`Failed to log ${eventKey} action execution: ${error.message}`, { error });
            throw new BadRequestException(`Failed to log ${eventKey} action execution: ${error.message}`);
        }
    }

    /**
     * Check if an event has already been executed for a contact today
     */
    async hasExecutedToday(
        agencyId: bigint,
        userId: bigint,
        contactId: bigint,
        eventKey: ContactTriggerEventType,
    ): Promise<boolean> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const triggerEvent = await this.prisma.triggerEvent.findFirst({
                where: { key: eventKey },
                select: { id: true },
            });

            if (!triggerEvent) {
                this.logger.error(`Trigger event not found for key: ${eventKey} `);
                return false;
            }

            const log = await this.prisma.triggerEventActionExecutionLog.findFirst({
                where: {
                    agencyId,
                    userId,
                    contactId,
                    triggerEventId: triggerEvent.id,
                    executedAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                select: { id: true },
            });

            return !!log;
        } catch (error) {
            this.logger.error(`Failed to check event execution: ${error.message} `, { error });
            return false;
        }
    }

    /**
     * Get all contacts that have had events executed today
     */
    async getExecutedContactsToday(
        agencyId: bigint,
        userId: bigint,
        eventKey: ContactTriggerEventType,
    ): Promise<bigint[]> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const triggerEvent = await this.prisma.triggerEvent.findFirst({
                where: { key: eventKey },
                select: { id: true },
            });

            if (!triggerEvent) {
                this.logger.error(`Trigger event not found for key: ${eventKey} `);
                return [];
            }

            const logs = await this.prisma.triggerEventActionExecutionLog.findMany({
                where: {
                    agencyId,
                    userId,
                    triggerEventId: triggerEvent.id,
                    executedAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                select: {
                    contactId: true,
                },
            });

            return logs.map((log) => log.contactId);
        } catch (error) {
            this.logger.error(`Failed to fetch executed contacts: ${error.message} `, { error });
            return [];
        }
    }
}