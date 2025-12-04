import { IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TriggerStatus } from '@prisma/client';

export class CommonGetTriggerDto {
    @ApiProperty({ required: false, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false, enum: TriggerStatus })
    @IsOptional()
    @IsEnum(TriggerStatus)
    status?: TriggerStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    agencyId?: bigint;

    //eventKey
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    eventKey?: string;
}