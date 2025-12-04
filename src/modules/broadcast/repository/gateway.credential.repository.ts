import { Injectable } from "@nestjs/common";
import { GatewayCredentialGatewayType, GatewayCredentials, GatewayCredentialStatus } from "@prisma/client";
import { isNull } from "lodash";
import { PrismaService } from "nestjs-prisma";


@Injectable()
export class GatewayCredentialRepository {

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async findGatewayCredtials(agencyId: bigint, userId: bigint, gatewayType: GatewayCredentialGatewayType, settingKeys: string[]) {
        if (!gatewayType || !settingKeys || settingKeys.length === 0) {
            return [];
        }

        const condition = {
            gatewayType,
            status: GatewayCredentialStatus.ACTIVE,
            settingKey: {
                in: settingKeys
            }
        }

        let gatewayCredentials: GatewayCredentials[] = [];
        if (userId != null) {
            gatewayCredentials = await this.prisma.gatewayCredentials.findMany({
                where: {
                    userId: userId,
                    ...condition
                },
                orderBy: {
                    agencyId: 'desc'
                },
                take: settingKeys.length
            })
        }

        if (gatewayCredentials && gatewayCredentials.length > 0) {
            return gatewayCredentials;
        }

        gatewayCredentials = await this.prisma.gatewayCredentials.findMany({
            where: {
                agencyId: agencyId,
                ...condition
            },
            orderBy: {
                agencyId: 'desc'
            },
            take: settingKeys.length,
        })

        if (gatewayCredentials && gatewayCredentials.length > 0) {
            return gatewayCredentials;
        }

        return await this.prisma.gatewayCredentials.findMany({
            where: {
                agencyId: { equals: null },
                ...condition
            },
            orderBy: {
                agencyId: 'desc'
            },
            take: settingKeys.length,
        })

    }
}