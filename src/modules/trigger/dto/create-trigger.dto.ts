import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TriggerStatus } from '@prisma/client';

export class CreateTriggerDto {
   
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ enum: TriggerStatus, required: false })
    @IsEnum(TriggerStatus)
    @IsOptional()
    status?: TriggerStatus;

    @ApiProperty({ required: false })
    @IsInt()
    @IsOptional()
    priority?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    timezone?: string;

    @ApiProperty({ required: false })
    @IsJSON()
    @IsOptional()
    metadata?: any;
}