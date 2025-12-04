import { IsString, IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InboxStatus, InboxReadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { InboxThreadQueryType } from 'src/types/inbox-threads';

export class InboxThreadQueryDto {
    @ApiProperty({ required: false, description: 'Search term for message content or from/to' })
    @IsOptional()
    @IsString()
    query?: string;

    @ApiProperty({ required: false, description: 'Number of items per page', default: 10 })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;

    @ApiProperty({ required: false, description: 'Page number', default: 1 })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number;


    //type =all|"assigned"|"mine"
    @ApiProperty({
        required: false,
        enum: InboxThreadQueryType,
        description: 'Filter by thread type (all, unassigned, mine)',
    })
    @IsOptional()
    @IsEnum(InboxThreadQueryType)
    type?: InboxThreadQueryType;

    //sortBy
    @ApiProperty({ required: false, enum: ['lastCommunication'], description: 'Sort by lastCommunication' })
    @IsOptional()
    @IsEnum(['lastCommunication'])
    sortBy?: 'lastCommunication';

    //sortOrder
    @ApiProperty({ required: false, enum: ['asc', 'desc'], description: 'Sort order' })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';
}