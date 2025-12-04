import { IsArray, IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { TRIGGER_EVENTS } from '../constants/trigger.constant';

export class ProcessTriggerDto {
    @ApiProperty({
        description: 'Event type to process',
        enum: TRIGGER_EVENTS,
    })
    @IsEnum(TRIGGER_EVENTS)
    @IsNotEmpty()
    event: keyof typeof TRIGGER_EVENTS;

    @ApiProperty({
        description: 'Array of contact IDs to process',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    contactIds: string[];

    @ApiProperty({
        description: 'Agency ID',
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    agencyId: string;
}

export class ProcessBirthdayDto {
    @ApiProperty({
        description: 'Array of contact IDs to process',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    contactIds: string[];

    @ApiProperty({
        description: 'Agency ID',
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    agencyId: string;
}

export class ProcessAnniversaryDto {
    @ApiProperty({
        description: 'Array of contact IDs to process',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    contactIds: string[];

    @ApiProperty({
        description: 'Agency ID',
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    agencyId: string;
}

export class FilterConditionDto {
    @IsString()
    @IsNotEmpty()
    field!: string;

    @IsString()
    @IsNotEmpty()
    operator!: string;

    @IsString()
    @IsNotEmpty()
    value!: string;
}


export class ContactTagActionDto {
  @ApiProperty({ type: [String], description: 'List of tag IDs (string or number)' })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => value.map((v: any) => String(v)))
  tagIds: string[];
}

