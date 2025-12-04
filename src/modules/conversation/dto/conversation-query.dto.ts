import { IsString, IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ConversationQueryDto {
    @ApiProperty({ required: false, description: 'Search term for message or phone number' })
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

    @ApiProperty({ required: false, enum: ['OPEN', 'CLOSED'], description: 'Filter by status' })
    @IsOptional()
    @IsEnum(['OPEN', 'CLOSED'])
    status?: string;
}