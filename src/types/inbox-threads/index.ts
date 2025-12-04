// types/inbox.ts
import type { inboxThreadBaseInclude } from "@/utils/prisma/includes/inbox-thread.includes";
import { Prisma, type ContactStatus, type UserStatus } from "@prisma/client";


// Prisma raw return (with includes)
export type PrismaInboxThread = Prisma.InboxThreadGetPayload<{
    include: typeof inboxThreadBaseInclude
}>;

export interface FormattedInboxThread {
    id: bigint;
    agencyId: bigint;
    userId: bigint;
    contactId: bigint;
    contentType: string;
    messageContent: string;
    mediaUrl?: string | null;
    from: string;
    to: string;
    status: string;
    lastCommunication?: Date | null;

    contact: {
        id: bigint;
        name: string;
        avatar?: string | null;
        phoneNumber: string;
        status: ContactStatus
    };

    isSentByAgent: boolean;

    // NEW : assigned user
    hasAssigned: boolean;
    assignedUser?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface InboxThreadResponse {
  id: bigint;
  agencyId: bigint;
  userId: bigint;
  contactId: bigint;
  contentType: string;
  messageContent: string;
  mediaUrl?: string | null;
  from: string;
  to: string;
  status: string;
  lastCommunication?: Date | null;

  firstName?: string | null;
  lastName?: string | null;
  phoneNumber: string;
  contactEmail?: string | null;

  isSentByAgent?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  assignedUserId?: number | null;
  hasAssigned?: boolean;
}

export interface CountResult {
  total: bigint; 
}

export enum InboxThreadQueryType {
    ALL = 'all',
    UNASSIGNED = 'unassigned',
    MINE = 'mine',
}


// Interface for raw query output, matching FormattedInboxThread requirements
export interface RawInboxThread {
    id: bigint;
    agency_id: bigint;
    user_id: bigint;
    contact_id: bigint;
    in_out: string;
    message_content: string;
    content_type: string;
    from: string;
    to: string;
    status: string;
    created_at: Date;
    last_communication: Date | null;
    created_by: bigint;
    contact_first_name: string;
    contact_last_name: string;
    contact_email: string;
    contact_number: string;
    contact_status: string;
    user_name: string | null;
    user_email: string;
    user_profile_url: string | null;
    user_status: string;


    // NEW: assigned user
    assigned_user_id?: bigint | null;
    assigned_user_name?: string | null;
    assigned_user_email?: string | null;
}