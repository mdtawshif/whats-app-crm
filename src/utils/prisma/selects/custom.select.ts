// server/prisma/selects/custom.select.ts
import { Prisma } from '@prisma/client';

export const agencySelect = {
    id: true,
    name: true,
    status: true,
    domain: true,
    domainPrefix: true,
    logoUrl: true,
} as const satisfies Prisma.AgencySelect;

export const userSelect = {
    id: true,
    parentUserId: true,
    agencyId: true,
    userName: true,
    email: true,
    profileUrl: true,
    status: true,
    timeZone: true
} as const satisfies Prisma.UserSelect;

export const contactSelect = {
    id: true,
    firstName: true,
    lastName: true,
    number: true,
    email: true,
    status: true,
} as const satisfies Prisma.ContactSelect;

// Properly typed include configurations
export const withAgency = {
    select: agencySelect
} as const satisfies Prisma.AgencyDefaultArgs;

export const withUser = {
    select: userSelect
} as const satisfies Prisma.UserDefaultArgs;

export const withContact = {
    select: contactSelect
} as const satisfies Prisma.ContactDefaultArgs;