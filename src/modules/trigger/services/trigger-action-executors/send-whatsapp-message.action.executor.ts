import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from 'nestjs-prisma'
import { BaseActionExecutor } from './base.action.executor'
import { TriggerExecutionLogService } from '../trigger-execution-log.service'
import { NotificationService } from 'src/modules/notifications/notifications.service'
import {
    CacheTriggerEventActionQueue,
    TriggerActionConfig,
    TriggerEventConfig,
    TriggerAction,
    TriggerEvent,
    TriggerEventExecutionLogStatus,
    type Contact,
    ContactStatus,
    UserStatus,
    TemplateStatus,
    GatewayCredentialGatewayType,
    MessageTemplate,
    ConversationInOut,
    ConversationStatus,
    ConversationReadStatus,
    WaBusinessNumber,
    InboxStatus,
    User,
    InOut,
    PricingMessageType
} from '@prisma/client'
import { TriggerExecutionResult } from '../../interfaces/trigger.interface'
import { ActionKeys } from 'src/types/triggers'
import { ConversationService } from 'src/modules/conversation/conversation.service'
import { ContactService } from 'src/modules/contacts/contact.service'
import {
    ConversationMessageType,
    InboxInOut,
    MessagingProduct
} from '@prisma/client'
import {
    ReceiverType,
    WhatsappMessageActionConfigData,
} from 'src/types/triggers/wa-message-action-executor.config.types'
import { getContactDisplayName } from '@/utils/contact'
import { WaSenderLoaderService } from '@/common/helpers/wa.sender.loader.service'
import { GatewayCredentialService } from 'src/modules/gateway-provider/gateway.credential.service'
import { TwilioWAMessageRequest } from 'src/modules/gateway-provider/twilio.wa.msg.request'
import { SandboxMessageSender } from 'src/modules/broadcast/broadcast-sender/sandbox.message.sender'
import { WAMessageResponse } from 'src/modules/gateway-provider/twilio.message.response'
import { CreateConversationLogDto, CreateInboxThreadLogDto } from 'src/modules/broadcast/dto/message-logs.dto'
import { MessageLogService } from 'src/modules/broadcast/message-log.service'
import { Decimal } from '@prisma/client/runtime/library'
import { deductMessageCost } from '@/common/helpers/cost-deduction-per-message'
import { TriggerUtils } from '../../utils/trigger.utils'
import { UserService } from 'src/modules/user/user.service'

@Injectable()
export class SendWhatsAppActionExecutor extends BaseActionExecutor {
    constructor(
        protected readonly prisma: PrismaService,
        protected readonly triggerExecutionLogService: TriggerExecutionLogService,
        protected readonly notificationService: NotificationService,
        private readonly conversationService: ConversationService,
        private readonly contactService: ContactService,
        private readonly waSenderLoaderService: WaSenderLoaderService,
        private readonly gatewayCredentialService: GatewayCredentialService,
        private readonly sandboxMessageSender: SandboxMessageSender,
        private readonly messageLogService: MessageLogService,
        private readonly userService: UserService,
        logger: PinoLogger
    ) {
        super(prisma, triggerExecutionLogService, notificationService, logger)
        this.logger.setContext(SendWhatsAppActionExecutor.name)
    }

    async executeAction(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueue,
        triggerActionConfig: TriggerActionConfig & { configs: WhatsappMessageActionConfigData },
        triggerEventConfig: TriggerEventConfig,
        triggerAction: TriggerAction,
        triggerEvent: TriggerEvent,
        skipNotification: boolean = false
    ): Promise<TriggerExecutionResult> {

        const startTime = Date.now()
        this.logger.info('Executing send WhatsApp', { queueId: cacheTriggerEventActionQueue.id })

        try {

            const { contactId, agencyId, userId } = cacheTriggerEventActionQueue;
            if (!contactId || !agencyId || !userId) {
                return this.createResult(false, 'Missing contactId, agencyId, or userId');
            }

            /**
             * @check toNumber
             */
            const recipient = await this.getRecipientNumber(cacheTriggerEventActionQueue, triggerActionConfig.configs);
            if (!recipient || !recipient.toNumber) {
                return this.createResult(false, 'To number not found');
            }

            /**
             * @Check user and current credit
             */
            console.log("cacheTriggerEventActionQueue: ", cacheTriggerEventActionQueue);
            const user: User = await this.findUser(cacheTriggerEventActionQueue.userId, cacheTriggerEventActionQueue.agencyId)
            if (!user) {
                return this.createResult(false, 'User not found');
            }
            let currentCredit = user.currentCredit;
            const isParent: boolean = user !== null && user.parentUserId === null
            if (!isParent) {
                const parentUser: User = await this.findUser(user.parentUserId, user.agencyId);
                currentCredit = parentUser ? parentUser.currentCredit : currentCredit;
            }
            if (currentCredit.lte(new Decimal(0))) {
                return this.createResult(false, 'Not enough credit');
            }


            const triggerActionConfigTyped = triggerActionConfig.configs as WhatsappMessageActionConfigData
            /**
             * @load and check fromNumber
             */
            let waFromNumber = await this.waSenderLoaderService.loadSenderWaNumber(cacheTriggerEventActionQueue.agencyId,
                cacheTriggerEventActionQueue.userId,
                cacheTriggerEventActionQueue.contactId,
                triggerActionConfigTyped?.sender_number // use user provided sender number it will get priority
            )

            if (!waFromNumber) {
                return this.createResult(false, 'From number not found');
            }

            /**
             * @Load and check message/messageTemplate
             */
            const waMessage = await this.loadMessage(user, triggerActionConfig.configs);
            if (!waMessage.message) {
                return this.createResult(false, 'Message not found');
            }

            const gatewayAuth = await this.gatewayCredentialService.loadGatewayCredentials(user, GatewayCredentialGatewayType.TWILIO, ["TWILIO_AUTH_KEY", "TWILIO_AUTH_TOKEN"]);
            if (!gatewayAuth) {
                return this.createResult(false, 'Gateway credentials not found');
            }

            let twilioWAMessageRequest: TwilioWAMessageRequest = {
                gatewayAuth: gatewayAuth,
                fromNumber: waFromNumber.number,
                toNumber: recipient.toNumber,
            };

            await this.prepareMessage(twilioWAMessageRequest, waMessage);

            console.log("twilioWAMessageRequest..............", twilioWAMessageRequest);
            const waMessageResponse: WAMessageResponse = await this.sandboxMessageSender.sendSandboxMessage(twilioWAMessageRequest);

            await this.addConversations(user, waMessageResponse, twilioWAMessageRequest, waFromNumber, cacheTriggerEventActionQueue.contactId);

            await this.addInboxThread(user, waMessageResponse, twilioWAMessageRequest, waMessage.messageTemplate, cacheTriggerEventActionQueue.contactId);

            if (waMessageResponse.success && !skipNotification) {
                await this.sendNotification(cacheTriggerEventActionQueue, triggerEvent,
                    { success: waMessageResponse.success, message: `WhatsApp messages sent successfully` },
                    `${TriggerUtils.normalizeActionKey(cacheTriggerEventActionQueue.triggerEventType)} : WhatsApp messages sent successfully`,
                    `Sent messages to ${getContactDisplayName({ displayName: recipient.displayName } as any)}`)
            }

            /**
             * @deduct credit
            */
            if (waMessageResponse.success) {
                await this.deductCredit(user, twilioWAMessageRequest);
            }

            const triggerEventExecutionLogStatus: TriggerEventExecutionLogStatus = waMessageResponse.success ? TriggerEventExecutionLogStatus.SUCCESS : TriggerEventExecutionLogStatus.FAILED;
            const error = waMessageResponse.success ? '' : waMessageResponse.errorMessage

            await this.logExecution(cacheTriggerEventActionQueue, triggerEventExecutionLogStatus, error, [cacheTriggerEventActionQueue.contactId]);

            return {
                success: waMessageResponse.success,
                message: waMessageResponse.success ? '' : waMessageResponse.errorMessage
            }
        } catch (error) {
            return this.handleError(
                cacheTriggerEventActionQueue,
                triggerEvent,
                `Failed to execute ${ActionKeys.SEND_WHATSAPP_MESSAGE}`,
                error,
                ActionKeys.SEND_WHATSAPP_MESSAGE,
                [cacheTriggerEventActionQueue.contactId]
            )
        }
    }

    private async prepareMessage(twilioWAMessageRequest: TwilioWAMessageRequest, waMessageTemplate: any) {
        if (waMessageTemplate.isTemplateMessage) {
            twilioWAMessageRequest.contentSid = waMessageTemplate.message;
            twilioWAMessageRequest.messageTemplateCategory = waMessageTemplate.messageTemplate.messageTemplateCategory
            twilioWAMessageRequest.contentVariables = await this.loadContentVariables(waMessageTemplate.messageTemplate);
            return;
        }
        twilioWAMessageRequest.messageBody = waMessageTemplate.message;
    }


    /**
     * @Load Recipient Number
     * @param cacheTriggerEventActionQueue 
     * @param configs 
     * @returns 
     */
    private async getRecipientNumber(cacheTriggerEventActionQueue: CacheTriggerEventActionQueue, configs: WhatsappMessageActionConfigData): Promise<{ toNumber: string, displayName: string }> {
        let toNumber: string = '';

        let receiverType: ReceiverType | undefined;
        if (configs?.receiver_type && Object.values(ReceiverType).includes(configs?.receiver_type as ReceiverType)) {
            receiverType = configs.receiver_type as ReceiverType;
        }
        switch (receiverType) {
            case ReceiverType.USER: {
                const userData = await this.userService.findById(cacheTriggerEventActionQueue.userId);
                toNumber = userData?.phone;
                return {
                    toNumber: toNumber,
                    displayName: userData.userName
                }

            }
            case ReceiverType.NUMBER: {
                toNumber = configs?.receiver_number;
                return {
                    toNumber: toNumber,
                    displayName: toNumber
                }
            }
            default: {
                const contact = await this.prisma.contact.findFirst({
                    where: {
                        id: cacheTriggerEventActionQueue.contactId,
                        status: ContactStatus.ACTIVE,
                    }
                });
                return {
                    toNumber: contact.number,
                    displayName: getContactDisplayName(contact)
                }
            }
        }

        //    
        // if ((Array.isArray(configs?.recipient) && configs.recipient.length > 0)) {
        //     toNumber = configs.recipient[0];
        // }
        // console.log("toNumber: ", toNumber);
        // const contacts: Contact = await this.findContactByNumber(cacheTriggerEventActionQueue.agencyId, toNumber);
        // if (contacts) {
        //     return {contacts, toNumber};
        // }

        // const contact = await this.prisma.contact.findFirst({
        //     where: {
        //         id: cacheTriggerEventActionQueue.contactId,
        //         status: ContactStatus.ACTIVE
        //     }
        // })
    }


    private async findContactByNumber(agencyId: bigint, number: string): Promise<Contact> {
        const contact = await this.prisma.contact.findFirst({
            where: {
                agencyId: agencyId,
                number: number,
                status: ContactStatus.ACTIVE
            }
        })
        return contact;
    }

    private async findUser(userId: bigint, agencyId: bigint): Promise<User> {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, agencyId, status: UserStatus.ACTIVE }
        })
        if (!user) {
            return null;
        }
        return user as User
    }

    private async loadMessage(user: User, configs: any): Promise<{ message: string, isTemplateMessage: boolean, messageTemplate?: MessageTemplate }> {
        if (configs?.message) {
            return {
                message: configs.message,
                isTemplateMessage: false,
            }
        }
        const messageTemplateId = configs?.message_template?.messageId;
        const messageTemplate = await this.prisma.messageTemplate.findFirst({
            where: {
                agencyId: user.agencyId,
                userId: user.id,
                messageId: messageTemplateId,
                status: TemplateStatus.APPROVED
            }
        })

        if (messageTemplate && messageTemplate.id) {
            return {
                message: messageTemplateId,
                isTemplateMessage: true,
                messageTemplate: messageTemplate
            }
        }
        return {
            message: '',
            isTemplateMessage: false
        }
    }

    public async loadContentVariables(messageTemplate: MessageTemplate) {
        const componentJSON = messageTemplate.components;

        // Check if componentJSON is valid (object or null/undefined)
        if (!componentJSON || !await this.isValidJson(componentJSON)) {
            return '{}';
        }
        const components = componentJSON;

        // Check if variables is valid
        const variables = (components as any)?.variables || {};
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

    public async isValidJson(data: any): Promise<boolean> {
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

    async addConversations(user: User, waMessageResponse: WAMessageResponse, twilioWAMessageRequest: TwilioWAMessageRequest,
        waBusinessNumber: WaBusinessNumber, contactId: bigint) {

        const waBusinessAccount = await this.findWaBusinessAccount(waBusinessNumber);

        const createConversationLogDto: CreateConversationLogDto = {
            agencyId: user.agencyId,
            userId: user.id,
            contactId: contactId,
            broadcastId: null,
            fromNumber: twilioWAMessageRequest.fromNumber,
            toNumber: twilioWAMessageRequest.toNumber,
            inOut: ConversationInOut.OUT,
            message: twilioWAMessageRequest.isTemplateMessage ? "" : twilioWAMessageRequest.messageBody,
            messageType: twilioWAMessageRequest.isTemplateMessage ? ConversationMessageType.TEMPLATE : ConversationMessageType.TEXT,
            messagingProduct: MessagingProduct.WHATS_APP,
            messageId: twilioWAMessageRequest.isTemplateMessage ? twilioWAMessageRequest.contentSid : "",
            response: JSON.stringify(waMessageResponse),
            status: waMessageResponse.success ? ConversationStatus.SENT : ConversationStatus.FAILED,
            lastMessageAt: new Date(),
            messageSid: waMessageResponse?.twilioMessageResponse?.sid || "",
            accountSid: twilioWAMessageRequest?.gatewayAuth?.authKey || "",
            isRead: ConversationReadStatus.UNREAD,
            phoneNumberId: waBusinessNumber.phoneNumberId,
            wabaId: waBusinessAccount ? waBusinessAccount.wabaId : null,
            wabaName: waBusinessAccount ? waBusinessAccount.name : null,
            businessId: null,
            businessName: null,
        }

        const conversation = await this.messageLogService.conversationLogs(createConversationLogDto);
        console.log("conversationId: " + conversation.id);
    }

    private async findWaBusinessAccount(waBusinessNumber: WaBusinessNumber) {
        return await this.prisma.waBusinessAccount.findFirst({
            where: {
                id: waBusinessNumber.waBusinessAccountId
            }
        })
    }

    private async addInboxThread(user: User, waMessageResponse: WAMessageResponse, twilioWAMessageRequest: TwilioWAMessageRequest,
        messageTemplate: MessageTemplate, contactId: bigint) {

        let message = twilioWAMessageRequest.messageBody;
        if (twilioWAMessageRequest.isTemplateMessage) {
            message = messageTemplate.name;
        }

        const createInboxThreadLogDto: CreateInboxThreadLogDto = {
            agencyId: user.agencyId,
            userId: user.id,
            contactId: contactId,
            contentType: twilioWAMessageRequest.isTemplateMessage ? "TEMPLATE" : "TEXT",
            isRead: ConversationReadStatus.UNREAD,
            inOut: InboxInOut.OUT,
            from: twilioWAMessageRequest.fromNumber,
            to: twilioWAMessageRequest.toNumber,
            status: waMessageResponse.success ? InboxStatus.SUCCESS : InboxStatus.FAILED,
            lastCommunication: new Date(),
            messageContent: message
        }

        const inboxThread = await this.messageLogService.createInboxThread(createInboxThreadLogDto);
        console.log("inboxThreadId: " + inboxThread.id);
    }

    /**
             * @Deduct credit
             * @param broadcastSendRequest 
             * @param twilioWAMessageRequest 
             */
    private async deductCredit(user: User, twilioWAMessageRequest: TwilioWAMessageRequest) {
        const category = twilioWAMessageRequest?.messageTemplateCategory;
        const messageType = twilioWAMessageRequest?.isTemplateMessage
            ? (PricingMessageType[category as keyof typeof PricingMessageType] ?? PricingMessageType.TEXT) : PricingMessageType.TEXT;

        const deductCostParams: {
            userId: bigint;
            messageType: PricingMessageType;
            createdBy: bigint;
            agencyId: bigint;
            broadcastId?: bigint;
            broadcastSettingId?: bigint;
            isSuccess: boolean;
            note?: string;
            transactionFor?: string;
            inOut: InOut;
        } = {
            userId: user.parentUserId ? user.parentUserId : user.id,
            createdBy: user.id ?? null,
            agencyId: user.agencyId,
            broadcastId: null,
            broadcastSettingId: null,
            messageType: messageType,
            isSuccess: true,
            note: `Send ${twilioWAMessageRequest.isTemplateMessage ? 'Template Message' : 'Text messsage'} from trigger`,
            transactionFor: 'Trigger Message',
            inOut: InOut.OUT
        };
        console.log("deductCostParams: ", deductCostParams);
        await deductMessageCost(deductCostParams);
    }

    // ------------------------------------------------------------------

    /*
    private async getRecipientsAndContacts(cacheTriggerEventActionQueue: CacheTriggerEventActionQueue, configs: WhatsappMessageActionConfigData): Promise<{
        recipients: string[]
        contacts: WhatsappMessageActionContact[]}> {
        
        let recipients: string[] = []
        let contacts: WhatsappMessageActionContact[] = []

        if (
            (Array.isArray(configs?.recipient) && configs.recipient.length > 0) ||
            (typeof configs?.recipient === 'string')
        ) {
            recipients = this.parseRecipients(configs.recipient)
            contacts = await TriggerUtils.getContactsByNumbers(
                this.prisma,
                recipients,
                cacheTriggerEventActionQueue.agencyId,
                cacheTriggerEventActionQueue.userId
            )
            recipients = contacts.map((c) => c.number).filter(Boolean)
        } else {
            // Default to contactId from queue
            const contact = await this.contactService.getContactById(
                cacheTriggerEventActionQueue.contactId
            )
            if (contact) {
              contacts = [contact]
              recipients = [contact.number].filter(Boolean)
            }
        }

        return { recipients, contacts }
    }

    private parseRecipients(recipient: string | string[]): string[] {
        return Array.isArray(recipient)
            ? recipient.map((r) => r.toString().trim())
            : recipient
                .toString()
                .split(',')
                .map((r) => r.trim())
    }

    

    
    private async getSenderInfo(
        contactId: bigint,
        agencyId: bigint,
        userId: bigint
    ): Promise<{ fromNumber: string; phoneNumberId: string }> {
        const lastConversation = await this.prisma.conversation.findFirst({
            where: {
                contactId,
                agencyId,
                userId,
                inOut: InboxInOut.OUT
            },
            select: {
                fromNumber: true,
                phoneNumberId: true
            },
            orderBy: { createdAt: 'desc' }
        })

        if (
            lastConversation &&
            lastConversation.fromNumber &&
            lastConversation.phoneNumberId
        ) {
            return {
                fromNumber: lastConversation.fromNumber,
                phoneNumberId: lastConversation.phoneNumberId
            }
        }

        const phone = await this.prisma.waBusinessNumber.findFirst({
            where: { agencyId, userId, numberStatus: WaNumberStatus.VERIFIED },
            select: { number: true, phoneNumberId: true }
        })
        if (!phone) {
            return {
                fromNumber: null,
                phoneNumberId: null,
            }
        }
        return {
            fromNumber: phone.number,
            phoneNumberId: phone.phoneNumberId.toString()
        }
    }

    

    private getEventBasedTemplate(event: EventKeys): string {
        const templates: Partial<Record<EventKeys, string>> = {
            [EventKeys.BIRTHDAY]: `Happy Birthday, {{firstName}}! Wishing you a day as exceptional as your contributions. May this year bring you unparalleled success and fulfillment. We're honored to celebrate with you! `,
            [EventKeys.ANNIVERSARY]: `Congratulations on your anniversary, {{firstName}}! Your journey inspires us all. Here's to continued growth, innovation, and shared achievements ahead. Cheers to many more! 🥂`,
            [EventKeys.CONTACT_ADDED]: `Welcome aboard, {{firstName}}! We're thrilled to connect and explore how we can create value together. Let's make impactful moves! 🚀`,
            [EventKeys.KEYWORD]: `Thanks for reaching out, {{firstName}}! Your message caught our eye—we're here to deliver top-tier support and solutions tailored just for you. What's next? 😊`,

        }
        return (
            templates[event] ||
            `Hello {{firstName}}, hope this finds you thriving! We're committed to delivering excellence—let us know how we can assist today. Best regards!`
        )
    }


    private async sendMessagesInBatches(
        cacheTriggerEventActionQueue: CacheTriggerEventActionQueue,
        recipients: string[],
        contacts: WhatsappMessageActionContact[],
        message: string,
        user: LoginUser,
        mediaUrl: string | undefined,
        triggerEvent: TriggerEvent
    ): Promise<
        TriggerExecutionResult & {
            perContactResults: {
                contactId: bigint
                success: boolean
                error?: string
            }[]
        }
    > {
        const perContactResults: {
            contactId: bigint
            success: boolean
            error?: string
        }[] = []
        let successCount = 0
        let failureCount = 0
        let startTime = Date.now()

        for (const contact of contacts) {
            try {
                const { fromNumber, phoneNumberId } = await this.getSenderInfo(
                    contact.id,
                    cacheTriggerEventActionQueue.agencyId,
                    cacheTriggerEventActionQueue.userId
                )

                const dto: SendMessageDto = {
                    contactId: contact.id.toString(),
                    message,
                    fromNumber,
                    toNumber: contact.number,
                    phoneNumberId,
                    messageType: mediaUrl ? ConversationMessageType.TEXT : ConversationMessageType.TEXT,
                    messagingProduct: MessagingProduct.WHATS_APP,
                    inOut: InboxInOut.OUT
                    // mediaUrl,
                }

                await this.conversationService.sendMessage(user, dto)
                perContactResults.push({ contactId: contact.id, success: true })

                await this.sendNotification(
                    cacheTriggerEventActionQueue,
                    triggerEvent,
                    { success: true, message: `WhatsApp messages sent successfully` },
                    `${triggerEvent.key} WhatsApp Blast! `,
                    `Sent messages to ${getContactDisplayName(contact as Contact)}`
                )

                successCount++
            } catch (error) {
                this.logger.error(
                    `Failed to send message to ${contact.number}: ${error.message}`
                )
                perContactResults.push({
                    contactId: contact.id,
                    success: false,
                    error: error.message
                })
                failureCount++
            }
        }

        return {
            success: successCount > 0,
            message: `Processed ${recipients.length} messages`,
            duration: Date.now() - startTime,
            processedCount: recipients.length,
            successCount,
            failureCount,
            duplicateCount: 0,
            existsCount: 0,
            perContactResults
        }
    }

   */
}
