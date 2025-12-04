import { PrismaClient, ActivityCategory, ActivityAction } from '@prisma/client';
import { BasicUser } from 'src/modules/user/dto/user.dto';

const prisma = new PrismaClient();

export interface CreateActivityInput {
    userId: bigint;
    agencyId: bigint;
    createdBy?: bigint;

    category: ActivityCategory;
    action: ActivityAction;
    description?: string;
    meta?: any;

    contactId?: bigint;
    tagId?: bigint;
    segmentId?: bigint;
    triggerId?: bigint;
    broadcastId?: bigint;
    messageTemplateId?: bigint;
    customFieldId?: bigint;
    waBusinessNumberId?: bigint;
    waBusinessAccountId?: bigint;
    fbBusinessAccountId?: bigint;
    userSettingId?: bigint;
    personalizationId?: bigint;
}

export async function createActivity(data: CreateActivityInput) {
    return prisma.activity.create({
        data: {
            userId: data.userId,
            agencyId: data.agencyId,
            createdBy: data.createdBy,

            category: data.category,
            action: data.action,
            description: data.description,
            meta: data.meta,

            contactId: data.contactId,
            tagId: data.tagId,
            segmentId: data.segmentId,
            triggerId: data.triggerId,
            broadcastId: data.broadcastId,
            messageTemplateId: data.messageTemplateId,
            customFieldId: data.customFieldId,
            waBusinessNumberId: data.waBusinessNumberId,
            waBusinessAccountId: data.waBusinessAccountId,
            fbBusinessAccountId: data.fbBusinessAccountId,
            userSettingId: data.userSettingId,
            personalizationId: data.personalizationId,
        },
    });
}
