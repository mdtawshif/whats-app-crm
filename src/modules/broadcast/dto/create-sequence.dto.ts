// dto/create-sequence.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BroadcastSettingStatus, BroadcastType, LimitType, PauseStopOption } from '@prisma/client';
import {
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsString,
    Matches,
    Min,
    ValidateIf,
    ValidateNested,
    IsNumber,
    IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

const HHMM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class SequenceTimeConfigDto {
    @ApiProperty({ enum: BroadcastType })
    @IsEnum(BroadcastType)
    type!: BroadcastType;

    @ApiPropertyOptional({
        description: 'If SCHEDULE: how many days later. If RECURRING: every N days.',
        example: 2,
        minimum: 0, // keep consistent with @Min(1)
    })
    @ValidateIf(o => o.type === 'SCHEDULE' || o.type === 'RECURRING')
    @IsInt()
    @Min(0)
    days?: number;

    @ApiPropertyOptional({
        description: 'Daily start time (HH:mm, 24h). Required for SCHEDULE/RECURRING.',
        example: '09:00',
    })
    @ValidateIf(o => o.type === 'SCHEDULE' || o.type === 'RECURRING')
    @IsString()
    @Matches(HHMM_REGEX, { message: 'startTime must be in HH:mm format (00:00–23:59)' })
    startTime?: string;
}

export class NumberSelectionDto {
    @ApiProperty({
        description: 'List of WhatsApp phone numbers (phone_number_id values)',
        isArray: true,
        example: [101231559522646],
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @Type(() => Number)                  // transform items to numbers
    @IsNumber({}, { each: true })        // validate each is a number
    phoneNumbers!: number[];
}

export class CreateSequenceDto {
    @ApiProperty({ type: () => SequenceTimeConfigDto })
    @ValidateNested()
    @Type(() => SequenceTimeConfigDto)
    timeConfig!: SequenceTimeConfigDto;

    @ApiProperty({ description: 'Template ID to send', example: 1 })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    // @IsNotEmpty()
    templateId!: number;

    @IsOptional()
    @IsString()
    messageBody: string

    @ApiProperty({ type: () => NumberSelectionDto })
    @ValidateNested()
    @Type(() => NumberSelectionDto)
    numberSelection!: NumberSelectionDto;

    // Priority (defaults to 0 if omitted)
    @ApiPropertyOptional({
        description: 'Execution priority within the broadcast (higher = earlier)',
        example: 0,
        default: 0,
        minimum: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    priority?: number;
}


export class BroadcastSequenceResponseDto {

    @ApiProperty() id!: number;

    @ApiProperty() broadcastId!: number;

    @ApiPropertyOptional({ nullable: true })
    messageTemplateId?: number;

    @ApiPropertyOptional({ nullable: true })
    messageBody: string

    @ApiProperty({ enum: BroadcastType })
    type!: BroadcastType;

    @ApiPropertyOptional({
        description: 'For SCHEDULE: how many days later. For RECURRING: every N days.',
        minimum: 0,
        nullable: true,
    })
    day?: number;

    @ApiPropertyOptional({
        minimum: 0,
        nullable: true,
    })
    priority?: number;

    @ApiProperty({
        description: 'Time of day in HH:mm (UTC)',
        example: '09:00',
    })
    time!: string;

    @ApiProperty({ enum: BroadcastSettingStatus })
    status!: BroadcastSettingStatus;

    // Operational settings (optional to expose; include if useful in your UI)
    @ApiPropertyOptional({ enum: LimitType, nullable: true })
    limitType?: LimitType;

    @ApiPropertyOptional({ nullable: true })
    limitValue?: number;

    @ApiPropertyOptional()
    retryCount?: number;

    @ApiPropertyOptional()
    retryDelaySeconds?: number;

    @ApiPropertyOptional({ enum: PauseStopOption, nullable: true })
    pauseOnError?: PauseStopOption;

    @ApiPropertyOptional({ enum: PauseStopOption, nullable: true })
    stopOnLimitExceeded?: PauseStopOption;

    @ApiProperty()
    @IsString()
    templateName?: string;

    @ApiProperty()
    @IsString()
    numberDisplayName?: string;

    @ApiProperty()
    number?: string;


    @ApiProperty()
    numberId?: number;

}

export class UpdateSequenceDto extends CreateSequenceDto {

}