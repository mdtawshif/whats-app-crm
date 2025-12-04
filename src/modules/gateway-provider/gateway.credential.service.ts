import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { GatewayAuth, GatewayType } from "./twilio.wa.msg.request";
import { GatewayCredentialGatewayType, GatewayCredentials, User, UserSetting } from "@prisma/client";
import { UserSettingRepository } from "../broadcast/repository/user.setting.respository";
import { GatewayCredentialRepository } from "../broadcast/repository/gateway.credential.repository";

/**
 * @Milton463
 */
@Injectable()
export class GatewayCredentialService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
        private readonly gatewayCredentialRepository: GatewayCredentialRepository
    ) {
        this.logger.setContext(GatewayCredentialService.name);
    }

    /**
     * @Load gateway credentials
     * @returns 
     */
    async loadGatewayCredentials(user: any, gatewayType: GatewayCredentialGatewayType, settingKey: string[]): Promise<GatewayAuth> {
        let gatewayAuth: GatewayAuth = {
            authKey: null,
            authToken: null,
            gateway: null
        }

        const gatewayCredentials: GatewayCredentials[] = await this.gatewayCredentialRepository.findGatewayCredtials(user.agencyId, user.id, gatewayType, settingKey);
        if (gatewayCredentials.length === 0) {
            return null;
        }

        gatewayCredentials.forEach(gatewayCredential => {
            switch (gatewayCredential.settingKey) {
                case "TWILIO_AUTH_KEY":
                    gatewayAuth.authKey = gatewayCredential.settingValue;
                    break;
                case "TWILIO_AUTH_TOKEN":
                    gatewayAuth.authToken = gatewayCredential.settingValue;
                    break;
                default:
                    break;
            }
        });
        return gatewayAuth;
    }
}