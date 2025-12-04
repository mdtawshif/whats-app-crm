import { BroadcastLogStatus, ConversationInOut, ConversationMessageType, ConversationReadStatus, ConversationStatus, InboxInOut, InboxReadStatus, InboxStatus, MessagingProduct } from '@prisma/client';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInboxThreadLogDto {
  @IsNumber()
  userId: bigint;

  @IsNumber()
  agencyId: bigint;

  @IsNumber()
  contactId: bigint;

  @IsOptional()
  @IsNumber()
  teamId?: bigint;

  @IsString()
  contentType: string;

  @IsEnum(InboxInOut)
  inOut: InboxInOut;

  @IsEnum(InboxReadStatus)
  isRead: InboxReadStatus;

  @IsOptional()
  @IsString()
  messageContent?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsEnum(InboxStatus)
  status: InboxStatus;

  @IsOptional()
  @IsDate()
  lastCommunication?: Date;
}

export class CreateBroadcastLogDto {
  @IsNumber()
  userId: bigint;

  @IsNumber()
  agencyId: bigint;

  @IsOptional()
  @IsNumber()
  teamId?: bigint;

  @IsNumber()
  contactId: bigint;

  @IsNumber()
  broadcastId: bigint;

  @IsNumber()
  broadcastSettingId: bigint;

  @IsNumber()
  waBusinessAccountId: bigint;

  @IsNumber()
  fbBusinessId: bigint;

  @IsNumber()
  waBusinessNumberId: bigint;

  @IsOptional()
  @IsNumber()
  message?: string;

  @IsOptional()
  @IsEnum(MessagingProduct)
  messagingProduct?: MessagingProduct;

  @IsOptional()
  @IsEnum(ConversationMessageType)
  messageType?: ConversationMessageType;

  @IsOptional()
  response?: any;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsEnum(BroadcastLogStatus)
  status?: BroadcastLogStatus;

  @IsOptional()
  @IsDate()
  lastMessageAt?: Date;
}

export class CreateConversationLogDto {
  @IsNumber()
  userId: bigint;

  @IsNumber()
  agencyId: bigint;

  @IsNumber()
  contactId: bigint;

  @IsOptional()
  @IsNumber()
  teamId?: bigint;

  @IsOptional()
  @IsNumber()
  broadcastId?: bigint;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  wabaName?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsString()
  phoneNumberId: string;

  @IsOptional()
  @IsString()
  fromNumber?: string;

  @IsOptional()
  @IsString()
  toNumber?: string;

  @IsOptional()
  @IsEnum(ConversationInOut)
  inOut?: ConversationInOut;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsEnum(ConversationMessageType)
  messageType?: ConversationMessageType;

  @IsOptional()
  @IsEnum(MessagingProduct)
  messagingProduct?: MessagingProduct;

  @IsOptional()
  response?: any;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsDate()
  lastMessageAt?: Date;

  @IsOptional()
  @IsEnum(ConversationReadStatus)
  isRead: ConversationReadStatus

  @IsOptional()
  @IsString()
  messageSid: string

  @IsOptional()
  @IsString()
  accountSid: string
}