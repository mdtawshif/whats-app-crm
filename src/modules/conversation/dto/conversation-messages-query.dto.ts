import { IsInt, Min, IsOptional, IsString, IsEnum } from 'class-validator';
// import { ConversationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { ConversationStatus } from '@prisma/client';

export class ConversationMessagesQueryDto {
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: 'Search term for message content' })
    query?: string;

    @IsInt()
    @Min(1)
    @Type(() => Number)
    @IsOptional()
    @ApiProperty({ required: false, description: 'Number of items per page (default: 20)', example: 20 })
    limit?: number = 20;

    @IsInt()
    @Min(1)
    @Type(() => Number)
    @IsOptional()
    @ApiProperty({ required: false, description: 'Page number (default: 1)', example: 1 })
    page?: number = 1;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false,  description: 'Filter by conversation status' })
    status?: ConversationStatus;
}