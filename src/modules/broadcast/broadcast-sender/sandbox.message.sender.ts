import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PinoLogger } from "nestjs-pino";
import { TwilioWAMessageRequest } from "src/modules/gateway-provider/twilio.wa.msg.request";
import { TwilioMessageStatus, TwilioWaErrorResponse, WAMessageResponse } from "src/modules/gateway-provider/twilio.message.response";
import { PrismaService } from "nestjs-prisma";

/**
 * @Milton463
 */
@Injectable()
export class SandboxMessageSender {

    constructor(
        private readonly logger: PinoLogger,
        private readonly prisma: PrismaService
    ) {
        this.logger.setContext(SandboxMessageSender.name);
    }

    async sendSandboxMessage(twilioWAMessageRequest: TwilioWAMessageRequest): Promise<WAMessageResponse> {
        
        const waMessageResponse: WAMessageResponse = {
            errorCode: null,
            success: false
        }

        /**
         * @@check message send request validation
         */
        const isValidToSendMessage = await this.isValidToSendMessage(twilioWAMessageRequest, waMessageResponse);
        if (!isValidToSendMessage) {
            waMessageResponse.success = false;
            return waMessageResponse;
        }

        try {
            const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioWAMessageRequest.gatewayAuth.authKey}/Messages.json`;
            this.logger.info('sendSandboxMessage');

            const formattedToNumber = twilioWAMessageRequest.toNumber.startsWith("+") ? twilioWAMessageRequest.toNumber : `+${twilioWAMessageRequest.toNumber}`;
            const formattedFromNumber = twilioWAMessageRequest.fromNumber.startsWith("+") ? twilioWAMessageRequest.fromNumber : `+${twilioWAMessageRequest.fromNumber}`;
            /**
             * @build message send request payload
             */
            const payload: {
                From: string;
                To: string;
                ContentSid?: string;
                ContentVariables?: string,
                Body?: string
            } = {
                From: `whatsapp:${formattedFromNumber}`,
                To: `whatsapp:${formattedToNumber}`,
            }
            if (twilioWAMessageRequest.isTemplateMessage) {
                payload.ContentSid = twilioWAMessageRequest.contentSid;
                payload.ContentVariables = twilioWAMessageRequest.contentVariables ? twilioWAMessageRequest.contentVariables : null;
            } else {
                payload.Body = twilioWAMessageRequest.messageBody;
            }

            console.log("twilioPayLoad: ", payload);
            const response = await axios.post(url, new URLSearchParams(payload).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${twilioWAMessageRequest.gatewayAuth.authKey}:${twilioWAMessageRequest.gatewayAuth.authToken}`).toString('base64')}`,
                },
            });

            if (response.status >= 200 && response.status < 300) {
                waMessageResponse.statusCode = response.status,
                    waMessageResponse.twilioMessageResponse = response.data;
                waMessageResponse.statusCode = response.status;
                const statusString = "queued";
                const statusEnum: TwilioMessageStatus = TwilioMessageStatus[statusString.toUpperCase() as keyof typeof TwilioMessageStatus];
                if (statusEnum === TwilioMessageStatus.QUEUED || statusEnum === TwilioMessageStatus.SENT
                    || statusEnum === TwilioMessageStatus.DELIVERED || statusEnum === TwilioMessageStatus.READ) {
                    waMessageResponse.success = true;
                }
                await this.syncMessageTemplateSummary(twilioWAMessageRequest, waMessageResponse.success);
                return waMessageResponse;
            }
            await this.syncMessageTemplateSummary(twilioWAMessageRequest, false);
            return waMessageResponse;

        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            if (axios.isAxiosError(error)) {
                console.log('errorResponse: ', error.response.data);
                const twilioWaErrorResponse: TwilioWaErrorResponse = error.response.data;
                waMessageResponse.errorCode = twilioWaErrorResponse.code;
                waMessageResponse.errorMessage = twilioWaErrorResponse.message;
                waMessageResponse.statusCode = twilioWaErrorResponse.status;
                waMessageResponse.success = false;
                await this.syncMessageTemplateSummary(twilioWAMessageRequest, false);
                return waMessageResponse;
            }
        }finally{
            return waMessageResponse;
        }
    }

    private async syncMessageTemplateSummary(twilioWAMessageRequest: TwilioWAMessageRequest, success: boolean): Promise<void> {

        const contentSid = twilioWAMessageRequest.contentSid;
        if (!contentSid) {
            return;
        }

        const messageTemplate = await this.prisma.messageTemplate.findFirst({
            where: {
                messageId: contentSid
            }
        });

        if (messageTemplate) {
            await this.prisma.messageTemplateSummary.update({
                where: { messageTemplateId: messageTemplate.id },
                data: {
                    totalSent: {
                        increment: 1,  // 👈 adds +1
                    },
                },
            });
        }


    }

    private async isValidToSendMessage(twilioWAMessageRequest: TwilioWAMessageRequest, waMessageResponse: WAMessageResponse) {
        const isValidToSendMessage = false;
        if (!twilioWAMessageRequest.gatewayAuth) {
            waMessageResponse.errorMessage = 'Gateway credentials not found'
            return isValidToSendMessage;
        }

        if (!twilioWAMessageRequest.gatewayAuth.authKey || !twilioWAMessageRequest.gatewayAuth.authToken) {
            waMessageResponse.errorMessage = 'Missing or invalid authentication details';
            return isValidToSendMessage;
        }

        if (!twilioWAMessageRequest.fromNumber) {
            waMessageResponse.errorMessage = "Unable to send message: 'from' number is missing";
            return isValidToSendMessage;
        }

        if (!twilioWAMessageRequest.toNumber) {
            waMessageResponse.errorMessage = "Unable to send message: 'to number is missing'";
            return isValidToSendMessage;
        }

        /**
         * @check validation for template message
         */
        if (twilioWAMessageRequest.isTemplateMessage && !twilioWAMessageRequest.contentSid) {
            waMessageResponse.errorMessage = 'Unable to send broadcast: contentSid is missing';
            return isValidToSendMessage;
        }

        /**
         * @cehck validation for free from message i.e message sending without template
         */
        if (!twilioWAMessageRequest.isTemplateMessage && !twilioWAMessageRequest.messageBody) {
            waMessageResponse.errorMessage = 'Unable to send broadcast: No message body found to send'
            return isValidToSendMessage;
        }

        return true;
    }

}