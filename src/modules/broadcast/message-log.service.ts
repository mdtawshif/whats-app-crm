import { ForbiddenException, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from "nestjs-prisma";
import { LoginUser } from "../auth/dto/login-user.dto";
import { PinoLogger } from 'nestjs-pino';
import { BroadcastLogStatus, BroadcastMessageLog, Conversation, InboxThread, MessagingProduct } from '@prisma/client';
import { CreateBroadcastLogDto, CreateConversationLogDto, CreateInboxThreadLogDto } from './dto/message-logs.dto';



@Injectable()
export class MessageLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger
  ) { }

  async broadcastLogMessageLogs(dto: CreateBroadcastLogDto): Promise<BroadcastMessageLog> {
    const {
      userId,
      agencyId,
      teamId,
      contactId,
      broadcastId,
      broadcastSettingId,
      waBusinessAccountId,
      fbBusinessId,
      waBusinessNumberId,
      message,
      messagingProduct,
      messageType,
      response,
      errorMessage,
      status = BroadcastLogStatus.SENT,
      lastMessageAt = new Date(),
    } = dto;

    try {
      // Step 1: Basic validation
      if (!userId || !agencyId || !contactId || !broadcastId || !broadcastSettingId || !waBusinessAccountId || !fbBusinessId || !waBusinessNumberId) {
        throw new BadRequestException("Missing required IDs to create broadcast log");
      }

      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) throw new NotFoundException(`User with id ${userId} not found`);

      const contactExists = await this.prisma.contact.findUnique({ where: { id: contactId } });
      if (!contactExists) throw new NotFoundException(`Contact with id ${contactId} not found`);

      const log = await this.prisma.broadcastMessageLog.create({
        data: {
          userId,
          agencyId,
          contactId,
          broadcastId,
          broadcastSettingId,
          waBusinessAccountId,
          fbBusinessId,
          waBusinessNumberId,
          message,
          messagingProduct,
          messageType,
          response,
          errorMessage,
          status,
          lastMessageAt,
        },
      });

      console.log(`Broadcast Message Log created for user ${userId}`, { logId: log.id });
      return log;
    } catch (error) {
      this.logger.error('Failed to create BroadcastMessageLog', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException("Could not create broadcast log");
    }
  }

  async conversationLogs(dto: CreateConversationLogDto): Promise<Conversation> {
    const {
      userId,
      agencyId,
      contactId,
      teamId,
      broadcastId,
      wabaId,
      wabaName,
      businessId,
      businessName,
      fromNumber,
      toNumber,
      phoneNumberId,
      inOut,
      message,
      messageId,
      messageType,
      messagingProduct,
      response,
      status,
      lastMessageAt = new Date(),
      messageSid,
      accountSid,
      isRead
    } = dto;

    try {
      // Step 5: Create conversation record
      const conversation = await this.prisma.conversation.create({
        data: {
          userId,
          agencyId,
          contactId,
          broadcastId: broadcastId || null,
          wabaId,
          wabaName,
          businessId,
          businessName,
          fromNumber,
          toNumber,
          phoneNumberId,
          inOut,
          message,
          messageId,
          messageType,
          messagingProduct,
          response,
          status,
          lastMessageAt,
          messageSid,
          accountSid,
          isRead
        },
      });

      console.log(`Conversation log created for user ${userId}`, { conversationId: conversation.id });
      return conversation;
    } catch (error) {
      this.logger.error('Failed to create Conversation', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException("Could not create conversation record");
    }
  }

  async createInboxThread(dto: CreateInboxThreadLogDto): Promise<InboxThread> {
    const {
      userId,
      agencyId,
      contactId,
      teamId,
      contentType,
      inOut,
      isRead,
      messageContent,
      mediaUrl,
      from,
      to,
      status,
      lastCommunication,
    } = dto;

    try {

      const existingThread = await this.prisma.inboxThread.findFirst({
        where: { userId, contactId },
      });

      let inboxThread: InboxThread;

      if (existingThread) {
        inboxThread = await this.prisma.inboxThread.update({
          where: { id: existingThread.id },
          data: {
            contentType,
            inOut,
            isRead,
            messageContent,
            mediaUrl,
            from,
            to,
            status,
            lastCommunication: lastCommunication || new Date(),
          },
        });
        this.logger.info(`InboxThread updated for user ${userId}`, { inboxThreadId: inboxThread.id });
      } else {
        inboxThread = await this.prisma.inboxThread.create({
          data: {
            userId,
            agencyId,
            contactId,
            contentType,
            inOut,
            isRead,
            messageContent,
            mediaUrl,
            from,
            to,
            status,
            lastCommunication: lastCommunication || null,
          },
        });
        this.logger.info(`InboxThread created for user ${userId}`, { inboxThreadId: inboxThread.id });
      }

      console.log(`InboxThread created for user ${userId}`, { inboxThreadId: inboxThread.id });
      return inboxThread;

    } catch (error) {
      this.logger.error('Failed to create InboxThread', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException("Could not create InboxThread");
    }
  }
}
