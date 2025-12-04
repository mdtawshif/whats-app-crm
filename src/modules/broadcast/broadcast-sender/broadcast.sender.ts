import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { SandboxMessageSender } from "./sandbox.message.sender";
import { BroadcastSendRequest } from "./broadcast.send.request";
import { GatewayCredentialService } from "src/modules/gateway-provider/gateway.credential.service";
import { TwilioWAMessageRequest } from "src/modules/gateway-provider/twilio.wa.msg.request";
import { WaBusinessNumberService } from "src/modules/whatsapp/service/wa.business.number.service";
import { MessageTemplateService } from "src/modules/whatsapp/service/wa.message.template.service";
import { BroadcastSendHelperService } from "./broadcast.send.helperService";
import { deductMessageCost } from "@/common/helpers/cost-deduction-per-message";
import { GatewayCredentialGatewayType, MessageTemplate, PricingMessageType } from "@prisma/client";
import { TwilioMessageResponse, WAMessageResponse } from "src/modules/gateway-provider/twilio.message.response";

/**
 * @Milton463
 */
@Injectable()
export class BroadcastSender {

    constructor(
        private readonly logger: PinoLogger,
        private readonly gatewayCredentialService: GatewayCredentialService,
        private readonly sendboxMessageSender: SandboxMessageSender,
        private readonly broadcastSendHelperService: BroadcastSendHelperService
       
    ){
        this.logger.setContext(BroadcastSender.name);
    }

    async sendBroadcastMessage(broadcastSendRequest: BroadcastSendRequest):Promise<WAMessageResponse>{

        let twilioWAMessageRequest: TwilioWAMessageRequest = {
            gatewayAuth: null,
            fromNumber: null,
            toNumber: null,
        };

        const gatewayAuth =  await this.gatewayCredentialService.loadGatewayCredentials({agencyId: broadcastSendRequest.user.agencyId, id:null}, GatewayCredentialGatewayType.TWILIO, ["TWILIO_AUTH_KEY", "TWILIO_AUTH_TOKEN"]);

        twilioWAMessageRequest.gatewayAuth = gatewayAuth;
        twilioWAMessageRequest.fromNumber = await this.loadFromNumber(broadcastSendRequest);
        twilioWAMessageRequest.toNumber = broadcastSendRequest.contact.number;

        await this.prepareMessage(broadcastSendRequest, twilioWAMessageRequest);
        broadcastSendRequest.twilioWAMessageRequest = twilioWAMessageRequest;
        /**
         * send message using using sandbox
         */
        console.log("twilioWAMessageRequest: {}",twilioWAMessageRequest);
        const response = await this.sendboxMessageSender.sendSandboxMessage(twilioWAMessageRequest);
        
        return response;
    }

    

    /**
     * @prepare message either with template or plain text
     * @param broadcastSendRequest 
     * @param twilioWAMessageRequest 
     * @returns 
     */
    private async prepareMessage(broadcastSendRequest: BroadcastSendRequest, twilioWAMessageRequest: TwilioWAMessageRequest){
    
        if(broadcastSendRequest.broadcastSetting.messageTemplateId){
          const messageTemplate = await this.broadcastSendHelperService.getMessageTemplateById(broadcastSendRequest.broadcastSetting.messageTemplateId);
          if(messageTemplate){
            twilioWAMessageRequest.contentSid = messageTemplate.messageId;
            // need to handle personalization and set ContentVariables
            twilioWAMessageRequest.contentVariables = await this.loadContentVariables(messageTemplate);
            twilioWAMessageRequest.isTemplateMessage = true;
            twilioWAMessageRequest.messageTemplateCategory = messageTemplate.category;
            broadcastSendRequest.messageTemplate = messageTemplate;
          }
          return;
        }
        twilioWAMessageRequest.isTemplateMessage = false;
        twilioWAMessageRequest.messageBody = broadcastSendRequest.broadcastSetting.messageBody;
    }

    private async loadFromNumber(broadcastSendRequest: BroadcastSendRequest):Promise<string>{
        const waBusinessNumber = await this.broadcastSendHelperService.getNumberDataById(broadcastSendRequest.broadcastMessageQueue.waBusinessNumberId);
        if(waBusinessNumber && waBusinessNumber.number){
            return waBusinessNumber.number;
        }
        return "";
    }

    public async loadContentVariables(messageTemplate: MessageTemplate){
        const componentJSON = messageTemplate.components;
        
        // Check if componentJSON is valid (object or null/undefined)
        if (!componentJSON || !await this.isValidJson(componentJSON)) {
            return '{}';
        }
        const components = componentJSON;

        // Check if variables is valid
        const variables = components.variables || {};
        if (!await this.isValidJson(variables)) {
            return '{}';
        }

        // Convert variables to ensure no null values
        const variablesJson: Record<string, string> = {};
        Object.keys(variables).forEach(key => {
            variablesJson[key] = variables[key] || "";
        });
        
        console.log("variablesJson....", JSON.stringify(variablesJson));

        return JSON.stringify(variablesJson)
        // return JSON.stringify(messageTemplate.components);
    }


   public async  isValidJson(data: any): Promise<boolean> {
        try {
            if (typeof data === "string") {
                JSON.parse(data);
            } else if (typeof data === "object" && data !== null) {
                JSON.stringify(data); // Check if object is serializable
            } else {
                return false;
            }
            return true;
        } catch (error) {
            console.log("error.JSON.....", error);
            return false;
        }
    }

}