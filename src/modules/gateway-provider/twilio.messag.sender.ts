

import { Injectable, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { MessageLogService } from "../broadcast/message-log.service";
import { LoginUser } from "../auth/dto/login-user.dto";
import { TwilioWAMessageRequest } from "./twilio.wa.msg.request";
import { ConversationMessageType, MessagingProduct } from "@prisma/client";
import { Twilio } from 'twilio';

@Injectable()
export class TwilioWAService {
  private client: Twilio | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: MessageLogService,
    private readonly logger: PinoLogger
  ) { }

  private async getGatewayAuth({userId}:{userId: bigint}) {
    const settings = await this.prisma.userSetting.findMany({
      where: {
        userId,
        status: "ACTIVE",
        settingKey: { in: ["TWILIO_AUTH_KEY", "TWILIO_AUTH_TOKEN", "TWILIO_GATEWAY"] },
      },
    });

    if (!settings.length) {
      throw new BadRequestException(`Twilio settings not found for user ${userId}`);
    }

    const map = Object.fromEntries(settings.map(s => [s.settingKey, s.value]));

    if (!map.TWILIO_AUTH_KEY || !map.TWILIO_AUTH_TOKEN) {
      throw new BadRequestException("Missing Twilio auth credentials in user settings");
    }

    return {
      authKey: map.TWILIO_AUTH_KEY,
      authToken: map.TWILIO_AUTH_TOKEN,
      gateway: map.TWILIO_GATEWAY ?? "TWILIO",
    };
  }

  async sendMessage(user: LoginUser, request: TwilioWAMessageRequest) {
    const { fromNumber, toNumber, contentSid, contentVariables, messageBody } = request;

    try {
      // Get Twilio credentials
      const gatewayAuth = await this.getGatewayAuth({userId: user.parentUserId ?? user.id});
      this.client = new Twilio(gatewayAuth.authKey, gatewayAuth.authToken);

      let contentSidToUse: string | undefined;
      let bodyToUse: string | undefined;

      // Business rules
      if (contentSid) {
        if (!messageBody) throw new BadRequestException("Message body required when contentSid is provided");
        contentSidToUse = contentSid;
        bodyToUse = messageBody;
      } else if (messageBody) {
        const template = await this.prisma.messageTemplate.findFirst({
          where: {
            agencyId: user.agencyId!,
            status: "APPROVED",
            name: messageBody,
          },
        });

        if (!template) throw new BadRequestException("No contentSid found for given message body");
        contentSidToUse = template.messageId;
        bodyToUse = messageBody;
      } else {
        throw new BadRequestException("Either contentSid+messageBody OR messageBody alone must be provided");
      }

      const twilioResp = await this.client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
        contentSid: contentSidToUse,
        contentVariables: contentVariables || undefined,
        body: bodyToUse,
      });

      try {
        await this.prisma.contact.findFirst({
          where:{
            userId: user.id,
          }
        })

        
      } catch (error) {
        
      }
      await this.logService.broadcastLogMessageLogs({
        userId: user.id,
        agencyId: user.agencyId!,
        contactId: BigInt(0), // set actual contactId
        broadcastId: BigInt(0), // set actual broadcastId
        broadcastSettingId: BigInt(0), // set actual broadcastSettingId
        waBusinessAccountId: BigInt(0),
        fbBusinessId: BigInt(0),
        waBusinessNumberId: BigInt(0),
        message: bodyToUse,
        messagingProduct: MessagingProduct.WHATS_APP,
        messageType: ConversationMessageType.TEXT,
        response: JSON.stringify(twilioResp),
        errorMessage: null,
        status: "SENT",
      });

      return twilioResp;
    } catch (error) {
      this.logger.error("Twilio WA send failed", error);

      await this.logService.broadcastLogMessageLogs({
        userId: user.id,
        agencyId: user.agencyId!,
        contactId: BigInt(0),
        broadcastId: BigInt(0),
        broadcastSettingId: BigInt(0),
        waBusinessAccountId: BigInt(0),
        fbBusinessId: BigInt(0),
        waBusinessNumberId: BigInt(0),
        message: messageBody || null,
        messagingProduct: MessagingProduct.WHATS_APP,
        messageType: ConversationMessageType.TEXT,
        response: null,
        errorMessage: error.message,
        status: "FAILED",
      });

      throw new InternalServerErrorException("Failed to send WhatsApp message");
    }
  }
}
