// utils/formatThreads.ts

import { InboxInOut, type Contact } from "@prisma/client";
import type { FormattedInboxThread, PrismaInboxThread } from "src/types/inbox-threads";
import { getContactDisplayName } from "./contact";





export function formatThread(thread: PrismaInboxThread & { // NEW : assigned user
    hasAssigned?: boolean;
    assignedUser?: {
        id: number;
        name: string;
        email: string;
    };
}): FormattedInboxThread {
    const isSentByAgent = thread.inOut === InboxInOut.OUT

    return {
        id: thread.id,
        agencyId: thread.agencyId,
        userId: thread.userId,
        contactId: thread.contactId,
        contentType: thread.contentType,
        messageContent: thread.messageContent,
        from: thread.from,
        to: thread.to,
        status: thread.status,
        lastCommunication: thread.lastCommunication,
        sender: isSentByAgent
            ? {
                id: thread.userId,
                name: "You",
                avatar: "",
                isCurrentUser: true,
                phoneNumber: thread.to,
            }
            : {
                id: thread.contact.id,
                name: getContactDisplayName(thread.contact as Contact),
                isCurrentUser: false,
                phoneNumber: thread.from,
                email: thread.contact.email,
                status: thread.contact.status,
            },
        isSentByAgent: isSentByAgent,

        contact: {
            id: thread.contact.id,
            name: getContactDisplayName(thread.contact as Contact),
            phoneNumber: thread.contact.number,
            status: thread.contact.status,
        },

        user: {
            id: thread.userId,
            name: "You",
            avatar: "",
            email: "",
        },
        // NEW: Assignment info
        hasAssigned: !!thread.hasAssigned,
        assignedUser: thread.assignedUser ? {
            id: Number(thread.assignedUser.id),
            name: thread.assignedUser.name || 'Unknown',
            email: thread.assignedUser.email || '',
        } : undefined,
    };
}

export function formatThreads(
    input: PrismaInboxThread[] | PrismaInboxThread
): FormattedInboxThread[] | FormattedInboxThread {
    return Array.isArray(input) ? input.map(formatThread) : formatThread(input);
}
