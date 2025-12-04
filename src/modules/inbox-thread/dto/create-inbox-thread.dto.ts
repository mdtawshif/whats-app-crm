import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InboxInOut, InboxReadStatus, InboxStatus } from '@prisma/client';

export class CreateInboxThreadDto {
    @ApiProperty()
    @IsNotEmpty()
    agencyId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    teamId?: string;

    @ApiProperty()
    @IsNotEmpty()
    userId: string;

    @ApiProperty()
    @IsNotEmpty()
    contactId: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    contentType: string;

    @ApiProperty({ enum: InboxInOut })
    @IsNotEmpty()
    @IsEnum(InboxInOut)
    inOut: InboxInOut;

    @ApiProperty({ enum: InboxReadStatus })
    @IsNotEmpty()
    @IsEnum(InboxReadStatus)
    isRead: InboxReadStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    messageContent?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    mediaUrl?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    from?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    to?: string;

    @ApiProperty({ enum: InboxStatus })
    @IsOptional()
    @IsNotEmpty()
    @IsEnum(InboxStatus)
    status: InboxStatus;

    //lastCommunication
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    lastCommunication?: string;
}