import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ConversationMessageType, InboxInOut, MessagingProduct } from '@prisma/client';

export class SendMessageDto {
    @IsString()
    contactId: string;

    @IsString()
    message: string;
    //messageId
    @IsString()
    @IsOptional()
    messageId?: string


    @IsString()
    fromNumber: string;

    @IsString()
    toNumber: string;

    @IsString()
    phoneNumberId: string;

    @IsEnum(ConversationMessageType)
    @IsOptional()
    messageType?: ConversationMessageType = ConversationMessageType.TEXT;

    @IsEnum(MessagingProduct)
    @IsOptional()
    messagingProduct?: MessagingProduct = MessagingProduct.WHATS_APP;

    //inout=InboxInOut
    @IsEnum(InboxInOut)
    @IsOptional()
    inOut?: InboxInOut = InboxInOut.OUT
}