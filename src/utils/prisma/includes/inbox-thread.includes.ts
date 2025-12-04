// server/prisma/includes/inbox-thread.includes.ts
import { Prisma } from '@prisma/client';
import { createInclude } from '../create-include';
import { withAgency, withUser, withContact } from '../selects/custom.select';

// Base include
export const inboxThreadBaseInclude = createInclude<Prisma.InboxThreadInclude>()({
    agency: withAgency,
    user: withUser,
    contact: withContact
});

export type InboxThreadBaseIncludeType = Prisma.InboxThreadGetPayload<{
    include: typeof inboxThreadBaseInclude
}>;
