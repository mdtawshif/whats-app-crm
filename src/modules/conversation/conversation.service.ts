import { Injectable } from '@nestjs/common'
import { PrismaService } from 'nestjs-prisma'
import { PinoLogger } from 'nestjs-pino'
import { CreateConversationDto, UpdateConversationDto } from './dto'
import {
  ConversationInOut,
  Prisma,
  InboxInOut,
  InboxStatus,
  InboxReadStatus,
  GatewayCredentialGatewayType,
  ConversationStatus,
  PricingMessageType,
  ConversationMessageType,
  MessagingProduct,
} from '@prisma/client'
import { InboxThreadService } from '../inbox-thread/inbox-thread.service'
import type { LoginUser } from '../auth/dto/login-user.dto'
import type { SendMessageDto } from './dto/send-message.dto'
import type { ConversationMessagesQueryDto } from './dto/conversation-messages-query.dto'
import { formatThread } from '@/utils/inbox-threads.utils'
import { SandboxMessageSender } from '../broadcast/broadcast-sender/sandbox.message.sender'
import { GatewayCredentialService } from '../gateway-provider/gateway.credential.service'
// import { normalizePhoneNumber } from '@/utils/formatNumber'
import { SearchUtils } from '@/utils/search.utils'
import { deductMessageCost } from '@/common/helpers/cost-deduction-per-message'
import { formatTwilioError } from '@/utils/errors/formatTwilioError'
import {
  TwilioMessageStatus,
  type WAMessageResponse
} from '../gateway-provider/twilio.message.response'
import type { GatewayAuth } from '../gateway-provider/twilio.wa.msg.request'
import type { SelectiveLastConversationMessage } from 'src/types/conversations'
import { normalizeThreadNumbers } from '@/utils/phone-numbers/format-phone-number'
import { WaBusinessNumberService } from '../whatsapp/service/wa.business.number.service'
import { inboxThreadBaseInclude } from '@/utils/prisma/includes/inbox-thread.includes'

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
    private readonly inboxThreadService: InboxThreadService,
    private readonly waBusinessNumberService: WaBusinessNumberService,
    private readonly sandboxMessageSender: SandboxMessageSender,
    private readonly gatewayCredentialService: GatewayCredentialService,
  ) {
    this.logger.setContext(ConversationService.name)
  }

  /**
   * Sends a WhatsApp message to a contact, creating or updating a thread and conversation.
   * Uses the provided fromNumber for existing threads or determines it via WaBusinessNumberService for new threads.
   * Logs to broadcast service on success or failure if broadcastId exists.
   * Deducts message cost for billing.
   * @param user The authenticated user sending the message.
   * @param sendMessageDto The message details (contactId, message, phone numbers, etc.).
   * @returns An object containing the created/updated thread (if new) and conversation record.
   * @throws Error if Twilio send fails, no valid sender number is found, or database operations fail.
   */
  async sendMessage(user: LoginUser, sendMessageDto: SendMessageDto) {
    const {
      contactId,
      message,
      messageId,
      fromNumber,
      toNumber,
      phoneNumberId,
      messageType = ConversationMessageType.TEXT,
      messagingProduct = MessagingProduct.WHATS_APP,
      inOut = InboxInOut.OUT,
    } = sendMessageDto;

    let gatewayAuth: GatewayAuth;
    let lastConversation: SelectiveLastConversationMessage | null = null;
    let twilioMessageResponse: WAMessageResponse | undefined;
    let finalFromNumber = '';
    let finalPhoneNumberId = phoneNumberId ?? '';

    try {
      this.logger.info('Sending message with data: %o', {
        agencyId: user.agencyId,
        userId: user.parentUserId ?? user.id,
        contactId,
        message
      })

      this.logger.info('Sending message with dto: %o', { sendMessageDto });

      // Normalize phone numbers for consistent thread lookup
      const { normalizedFrom, normalizedTo } = normalizeThreadNumbers(fromNumber, toNumber);

      // Load Twilio credentials for WhatsApp messaging
      gatewayAuth = await this.gatewayCredentialService.loadGatewayCredentials(
        { agencyId: user.agencyId },
        GatewayCredentialGatewayType.TWILIO,
        ['TWILIO_AUTH_KEY', 'TWILIO_AUTH_TOKEN'],
      );

      // Check for existing thread to maintain conversation continuity
      const existingThread = await this.prisma.inboxThread.findFirst({
        where: {
          agencyId: user.agencyId,
          userId: user.parentUserId ?? user.id,
          contactId: BigInt(contactId)
        },
      });

      // Get last conversation for WhatsApp/Business metadata
      lastConversation = await this.prisma.conversation.findFirst({
        where: {
          contactId: BigInt(contactId),
          agencyId: user.agencyId,
          userId: user.parentUserId ?? user.id,
          inOut: ConversationInOut.OUT
        },
        select: {
          wabaId: true,
          broadcastId: true,
          wabaName: true,
          businessId: true,
          businessName: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Determine sender number: use thread's fromNumber or fetch via service
      finalFromNumber = normalizedFrom;
      if (!existingThread) {
        const { fromNumber: determinedFrom, phoneNumberId: determinedId } =
          await this.waBusinessNumberService.determineSenderNumber({ agencyId: user.agencyId, userId: user.parentUserId ?? user.id, phoneNumberId });
        finalFromNumber = determinedFrom;
        finalPhoneNumberId = determinedId;
      }

      // Send message via Twilio
      try {
        //for testing demo twilio success
        // twilioMessageResponse = {
        //   success: true,
        //   twilioMessageResponse: {
        //     sid: "123",
        //     account_sid: "",
        //     api_version: "",
        //     body: message,
        //     date_created: "",
        //     date_sent: "",
        //     date_updated: "",
        //     direction: "",
        //   },
        // }

        //for live send message via twilio
        twilioMessageResponse = await this.sandboxMessageSender.sendSandboxMessage({
          gatewayAuth,
          fromNumber: finalFromNumber,
          toNumber: normalizedTo,
          messageBody: message,
        });

        if (!twilioMessageResponse?.success) {
          const { userMessage, technicalMessage } = formatTwilioError({
            errorCode: twilioMessageResponse.errorCode,
            statusCode: twilioMessageResponse.statusCode,
            errorMessage: twilioMessageResponse.errorMessage,
            twilioStatus: twilioMessageResponse.twilioMessageResponse?.status
              ? TwilioMessageStatus[
              twilioMessageResponse.twilioMessageResponse.status.toUpperCase() as keyof typeof TwilioMessageStatus
              ]
              : null,
          });
          this.logger.error(technicalMessage);
          throw new Error(userMessage);
        }
      } catch (error) {
        this.logger.error(`Failed to send message via Twilio: ${error.message}`);
        const { userMessage, technicalMessage } = formatTwilioError({
          errorCode: error.code,
          statusCode: error?.status || error.response?.status,
          errorMessage: error.message,
          twilioStatus: null,
        });
        this.logger.error(technicalMessage);
        throw new Error(userMessage);
      }

      let isNewlyCreated = false;


      // Use Prisma transaction for atomic operations
      const [thread, conversation] = await this.prisma.$transaction(
        async (tx) => {
          let threadResult: any = null

          if (!existingThread) {
            // Create new thread with business number as sender
            isNewlyCreated = true
            this.logger.info(
              'Creating new thread for user: %s and contact: %s',
              user.parentUserId ?? user.id,
              contactId
            )

            threadResult = await this.inboxThreadService.createInboxThread({
              agencyId: user.agencyId.toString(),
              userId: user.id.toString(),
              contactId: contactId.toString(),
              from: finalFromNumber,
              to: normalizedTo,
              messageContent: message,
              contentType: messageType,
              inOut,
              isRead: InboxReadStatus.UNREAD,
              status: InboxStatus.SUCCESS,
            });
          } else {
            // Update existing thread with new message details
            threadResult = await this.inboxThreadService.updateInboxThread(existingThread?.id?.toString(), {
              contactId: contactId.toString(),
              agencyId: user.agencyId.toString(),
              userId: user.id.toString(),
              messageContent: message,
              lastCommunication: new Date().toISOString(),
              isRead: InboxReadStatus.UNREAD,
              inOut,
            });
          }

          // Create conversation entry to log the message
          const conversationResult = await tx.conversation.create({
            data: {
              fromNumber: inOut === InboxInOut.IN ? normalizedTo : finalFromNumber,
              toNumber: inOut === InboxInOut.IN ? finalFromNumber : normalizedTo,
              phoneNumberId: finalPhoneNumberId,
              message,
              inOut,
              messageType,
              messageId: messageId ? messageId : undefined, // when messageType=TEMPLATE
              messagingProduct,
              status: ConversationStatus.SENT,
              lastMessageAt: new Date(),
              messageSid: twilioMessageResponse?.twilioMessageResponse?.sid,
              accountSid: twilioMessageResponse?.twilioMessageResponse?.account_sid,
              response: twilioMessageResponse ? JSON.stringify(twilioMessageResponse) : undefined,
              // Copy WhatsApp/business fields from last conversation
              wabaId: lastConversation?.wabaId ?? null,
              wabaName: lastConversation?.wabaName ?? null,
              businessId: lastConversation?.businessId ?? null,
              businessName: lastConversation?.businessName ?? null,
              // Connect related entities
              user: { connect: { id: user.id } },
              agency: { connect: { id: user.agencyId } },
              contact: { connect: { id: BigInt(contactId) } },
            },
            include: inboxThreadBaseInclude
          });

          return [threadResult, conversationResult];
        });

      // Log success to broadcast service if broadcastId exists
      // await this.broadcastSendLogEntryService.createMessageQueueLog(
      //   {
      //     success: true,
      //     user: user as any,
      //     contact: { id: BigInt(contactId) } as any,
      //     broadcast: lastConversation?.broadcastId ? { id: lastConversation.broadcastId } as any : undefined,
      //     waBusinessAccount: lastConversation?.wabaId ? { id: lastConversation.wabaId } as any : undefined,
      //     fbBusinessAccount: lastConversation?.businessId ? { id: lastConversation.businessId } as any : undefined,
      //     // broadcastMessageQueue: { waBusinessNumberId: BigInt(finalPhoneNumberId) } as any,
      //     twilioWAMessageRequest: {
      //       gatewayAuth,
      //       messageBody: message,
      //       isTemplateMessage: messageType === ConversationMessageType.TEMPLATE,
      //     },
      //   },
      //   twilioMessageResponse,
      // );

      // Deduct message cost for billing
      await deductMessageCost(
        {
          userId: user.parentUserId ? user.parentUserId : user.id,
          agencyId: user.agencyId,
          createdBy: user.id,
          messageType: PricingMessageType.TEXT,
          isSuccess: true,
          note: `Sent message to ${contactId}`,
          inOut,
          transactionFor: 'Message',
        },
      );

      return {
        thread: thread?.id && isNewlyCreated ? formatThread(thread as any) : null,
        conversation,
      };
    } catch (error: any) {
      // Log failure to broadcast service if broadcastId exists
      // await this.broadcastSendLogEntryService.createMessageQueueLog(
      //   {
      //     success: false,
      //     errorMessage: error.message,
      //     user: user as any,
      //     contact: { id: BigInt(contactId) } as any,
      //     broadcast: lastConversation?.broadcastId ? { id: lastConversation.broadcastId } as any : undefined,
      //     waBusinessAccount: lastConversation?.wabaId ? { id: lastConversation.wabaId } as any : undefined,
      //     fbBusinessAccount: lastConversation?.businessId ? { id: lastConversation.businessId } as any : undefined,
      //     // broadcastMessageQueue: { waBusinessNumberId: BigInt(phoneNumberId || '') } as any,
      //     twilioWAMessageRequest: {
      //       gatewayAuth,
      //       messageBody: message,
      //       isTemplateMessage: messageType === ConversationMessageType.TEMPLATE,
      //     },
      //   },
      //   twilioMessageResponse,
      // );
      console.log("Conversation(SEND-MESSAGE), message sending error", error);

      throw new Error(error.message);
    }
  }


  /**
   * Get conversation messages
   * 
   * @param contactId - The ID of the contact
   * @param agencyId - The ID of the agency
   * @param query - The query parameters
   * 
   * @returns { thread, conversation }
   */
  async getConversationMessages(
    contactId: string,
    user: LoginUser,
    query: ConversationMessagesQueryDto
  ) {
    this.logger.info(
      'Fetching messages for contact %s, agency %s with query: %o',
      contactId,
      user.agencyId,
      query
    )
    const { query: search, limit = 20, page = 1, status } = query
    const skip = (page - 1) * limit

    // Build base where clause
    const baseWhere: Prisma.ConversationWhereInput = {
      contactId: BigInt(contactId),
      agencyId: user.agencyId
    }

    // Apply status filter if provided
    if (status) baseWhere.status = status

    // Apply search if provided
    const where = search
      ? SearchUtils.applySearch<Prisma.ConversationWhereInput>(
        baseWhere,
        search,
        {
          fields: ['message'],
          strategy: 'ALL',
          minTermLength: 2,
          maxTerms: 5,
          caseSensitive: false
        }
      )
      : baseWhere

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        take: limit,
        skip,
        include: {
          user: {
            select: {
              id: true,
              agencyId: true,
              userName: true,
              email: true,
              profileUrl: true
            }
          },
          agency: true,
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              number: true,
              email: true,
              status: true
            }
          },
          // team: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.conversation.count({ where })
    ])

    const nextPage = total > page * limit ? page + 1 : null


    // Batch fetch templates for TEMPLATE messages to optimize (avoids N+1 queries)
    const templateMessageIds = data
      .filter(convo => convo.messageType === ConversationMessageType.TEMPLATE && convo.messageId)
      .map(convo => convo.messageId!); // ! since filtered

    const uniqueIds = [...new Set(templateMessageIds)]; // Dedupe for efficiency
    const templates = uniqueIds.length
      ? await this.prisma.messageTemplate.findMany({
        where: { messageId: { in: uniqueIds } },
        select: { messageId: true, components: true, name: true, category: true, language: true } // Only fetch what we need
      })
      : [];
    const templateMap = new Map(templates.map(t => [t.messageId!, t])); // Map for O(1) lookups

    // Format data with sender information
    const formattedData = data.map((conversation) => {
      let message = conversation.message ?? ''; // Fallback for null message
      let template: any = null;

      // Handle TEMPLATE rendering
      if (conversation.messageType === ConversationMessageType.TEMPLATE && conversation.messageId) {
        template = templateMap.get(conversation.messageId);
        if (template?.components) {
          try {
            const components = template.components as Record<string, any>; // Prisma Json is object
            const card = components.types?.['whatsapp/card'];
            if (card?.body && components.variables) {
              // Sync variable extraction (components is object, no async needed)
              const variables: Record<string, string> = components.variables || {};
              const variablesJson: Record<string, string> = {};
              Object.entries(variables).forEach(([key, value]) => {
                variablesJson[key] = String(value ?? ''); // Ensure string, handle null/undefined
              });


              // Replace {{n}} placeholders efficiently
              message = card.body.replace(/\{\{(\d+)\}\}/g, (match, key) => {
                return variablesJson[key] || match; // Fallback to original placeholder
              });
            }
          } catch (error) {
            this.logger.error(`Failed to parse template components for messageId ${conversation.messageId}:`, error);
            // Fallback to original message to avoid breaking UI
          }
        }
      }

      // Determine sender based on phone numbers
      const isSentByAgent = conversation.inOut === ConversationInOut.OUT;
      return {
        id: conversation.id,
        agencyId: conversation.agencyId,
        contactId: conversation.contactId,
        userId: conversation.userId,
        broadcastId: conversation.broadcastId,
        wabaId: conversation.wabaId,
        wabaName: conversation.wabaName,
        businessId: conversation.businessId,
        businessName: conversation.businessName,
        fromNumber: conversation.fromNumber,
        toNumber: conversation.toNumber,
        phoneNumberId: conversation.phoneNumberId,
        inOut: conversation.inOut,
        message, // Updated message
        template,
        messageId: conversation.messageId,
        messageType: conversation.messageType,
        messagingProduct: conversation.messagingProduct,
        response: conversation.response,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,

        // Sender information
        sender: isSentByAgent
          ? {
            id: conversation.user.id,
            name: conversation.user.userName,
            // avatar: conversation.user.profileUrl,
            isCurrentUser: true,
            phoneNumber: conversation.toNumber
          }
          : {
            id: conversation.contact.id,
            name: `${conversation.contact.firstName} ${conversation.contact.lastName}`,
            // avatar: conversation.contact?.profileUrl,
            isCurrentUser: false,
            phoneNumber: conversation.fromNumber
          },

        // Recipient information
        recipient: isSentByAgent
          ? {
            id: conversation.contact.id,
            name: `${conversation.contact.firstName} ${conversation.contact.lastName}`,
            // avatar: conversation.contact?.profileUrl,
            isCurrentUser: false,
            phoneNumber: conversation.fromNumber
          }
          : {
            id: conversation.user.id,
            name: conversation.user.userName,
            avatar: conversation.user.profileUrl,
            isCurrentUser: true,
            phoneNumber: conversation.toNumber
          },

        // Additional useful fields
        isSentByAgent: isSentByAgent,
        contact: {
          id: conversation.contact.id,
          name: `${conversation.contact.firstName} ${conversation.contact.lastName}`,
          // avatar: conversation.contact?.profileUrl,
          phoneNumber: conversation.contact.number,
          status: conversation.contact.status,

        },
        user: {
          id: conversation.user.id,
          name: conversation.user.userName,
          avatar: conversation.user.profileUrl
        }
      };
    });

    return {
      data: formattedData,
      nextPage,
      total
    };
  }

  async getConversation(id: string) {
    this.logger.info('Fetching conversation with ID: %s', id)
    return this.prisma.conversation.findUniqueOrThrow({
      where: { id: BigInt(id) },
      include: {
        user: {
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            userName: true,
            email: true,
            profileUrl: true
          }
        }, agency: true, contact: true
      }
    })
  }

  async createConversation(dto: CreateConversationDto) {
    this.logger.info('Creating conversation with data: %o', dto)
    return this.prisma.conversation.create({
      data: {
        agencyId: dto.agencyId,
        contactId: dto.contactId,
        userId: dto.userId,
        broadcastId: dto.broadcastId ?? null,
        wabaId: dto.wabaId,
        wabaName: dto.wabaName,
        businessId: dto.businessId,
        businessName: dto.businessName,
        fromNumber: dto.fromNumber,
        toNumber: dto.toNumber,
        phoneNumberId: dto.phoneNumberId,
        inOut: dto.inOut,
        message: dto.message,
        messageId: dto.messageId,
        messageType: dto.messageType,
        messagingProduct: dto.messagingProduct,
        response: dto.response,
      },
      include: {
        user: {
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            userName: true,
            email: true,
            profileUrl: true
          }
        }, agency: true, contact: true
      }
    })
  }

  async updateConversation(id: string, dto: UpdateConversationDto) {
    this.logger.info('Updating conversation ID: %s with data: %o', id, dto)
    return this.prisma.conversation.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto as Prisma.ConversationUpdateInput),
        broadcastId: dto.broadcastId ? BigInt(dto.broadcastId) : null
      },
      include: {
        user: {
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            userName: true,
            email: true,
            profileUrl: true
          }
        }, agency: true, contact: true
      }
    })
  }

  async deleteConversation(id: string) {
    this.logger.info('Deleting conversation ID: %s', id)
    await this.prisma.conversation.delete({
      where: { id: BigInt(id) }
    })
  }
}