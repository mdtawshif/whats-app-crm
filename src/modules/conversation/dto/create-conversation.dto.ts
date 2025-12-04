import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationInOut, ConversationMessageType, MessagingProduct } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateConversationDto {
  @ApiProperty()
  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  agencyId: bigint;

  @ApiProperty()
  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  contactId: bigint;

  @ApiProperty()
  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  userId: bigint;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? BigInt(value) : null))
  teamId?: bigint | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? BigInt(value) : null))
  broadcastId?: bigint | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  wabaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  wabaName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  toNumber?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  phoneNumberId: string;

  @ApiProperty({ enum: ConversationInOut, required: false })
  @IsOptional()
  @IsEnum(ConversationInOut)
  inOut?: ConversationInOut;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiProperty({ enum: ConversationMessageType, required: false })
  @IsOptional()
  @IsEnum(ConversationMessageType)
  messageType?: ConversationMessageType;

  @ApiProperty({ enum: MessagingProduct, required: false })
  @IsOptional()
  @IsEnum(MessagingProduct)
  messagingProduct?: MessagingProduct;

  @ApiProperty({ required: false })
  @IsOptional()
  response?: any;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  status: string;
}