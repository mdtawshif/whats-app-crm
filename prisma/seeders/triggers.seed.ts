import { PrismaClient, type Prisma } from '@prisma/client';

import { EventKeys, ActionKeys, TriggerEvent, Action, allowedEvents, defineTriggerEvent } from '../../src/types/triggers';
import { TRIGGER_EVENTS, TRIGGER_ACTIONS } from '../../src/modules/trigger/constants/trigger.constant';
const prisma = new PrismaClient();

export async function seedTriggers() {
    try {
        console.log('Seeding trigger events and actions...');

        // 1️⃣ Sync Trigger Events
        const existingEvents = await prisma.triggerEvent.findMany({ select: { key: true } });
        const existingEventKeys = new Set(existingEvents.map(e => e.key));
        const currentEventKeys = new Set(TRIGGER_EVENTS.map(e => e.key));

        for (const event of TRIGGER_EVENTS) {
            const metadata: Prisma.InputJsonObject = event.metadata;
            await prisma.triggerEvent.upsert({
                where: { key: event.key },
                update: {
                    title: event.title,
                    description: event.description,
                    metadata,
                    allowedActions: event.allowedActions,
                },
                create: {
                    key: event.key,
                    title: event.title,
                    description: event.description,
                    metadata,
                    allowedActions: event.allowedActions,
                    createdAt: new Date(),
                },
            });
            console.log(` Upserted Trigger Event: ${event.title} (Key: ${event.key})`);
        }

        // Remove obsolete events
        const eventsToDelete = Array.from(existingEventKeys).filter(key => !currentEventKeys.has(key as EventKeys));
        if (eventsToDelete.length > 0) {
            await prisma.triggerEvent.deleteMany({ where: { key: { in: eventsToDelete } } });
            console.log(`🗑️ Deleted obsolete Trigger Events: ${eventsToDelete.join(', ')}`);
        }

        // 2️⃣ Sync Trigger Actions
        const existingActions = await prisma.triggerAction.findMany({ select: { key: true } });
        const existingActionKeys = new Set(existingActions.map(a => a.key));
        const currentActionKeys = new Set(TRIGGER_ACTIONS.map(a => a.key));

        for (const action of TRIGGER_ACTIONS) {
            const metadata: Prisma.InputJsonObject = action.metadata;
            await prisma.triggerAction.upsert({
                where: { key: action.key },
                update: {
                    title: action.title,
                    description: action.description,
                    metadata,
                },
                create: {
                    key: action.key,
                    title: action.title,
                    description: action.description,
                    metadata,
                    createdAt: new Date(),
                },
            });
            console.log(` Upserted Trigger Action: ${action.title} (Key: ${action.key})`);
        }

        // Remove obsolete actions
        const actionsToDelete = Array.from(existingActionKeys).filter(key => !currentActionKeys.has(key as ActionKeys));
        if (actionsToDelete.length > 0) {
            await prisma.triggerAction.deleteMany({ where: { key: { in: actionsToDelete } } });
            console.log(`🗑️ Deleted obsolete Trigger Actions: ${actionsToDelete.join(', ')}`);
        }

        console.log('✨ Trigger events and actions fully synced!');
    } catch (error) {
        console.error('Error seeding triggers:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if script is main
if (require.main === module) {
    console.log('Seeding triggers in the main process...');
    seedTriggers().catch(e => process.exit(1));
}