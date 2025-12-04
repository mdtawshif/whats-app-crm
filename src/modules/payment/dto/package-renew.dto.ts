import { Prisma } from "@prisma/client";

export class PackageRenewUserCardInfo {
    teamId: number | null;
    userId: number | null;
    packageId: number | null;
    customerId: string | null;
    chargeAmount: Prisma.Decimal | number | string;
    cardInfoId: number;
}