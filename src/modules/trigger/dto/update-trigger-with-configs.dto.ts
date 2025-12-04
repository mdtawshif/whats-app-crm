import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class EventConfigDto {
    @ApiProperty({ description: 'Event key', example: 'EXTERNAL_WEBHOOK' })
    @IsNotEmpty()
    @IsString()
    key: string;

    @ApiProperty({ description: 'Event title', example: 'External Webhook Trigger' })
    @IsNotEmpty()
    @IsString()
    title: string;
}

export class FilterConfigDto {
    @ApiProperty({ description: 'Filter field', example: 'source' })
    @IsNotEmpty()
    @IsString()
    field: string;

    @ApiProperty({ description: 'Filter operator', example: 'equals' })
    @IsNotEmpty()
    @IsString()
    operator: string;

    @ApiProperty({ description: 'Filter value', example: 'agagaga' })
    @IsOptional()
    value: any;
}

class ActionConfigDto {
    @ApiProperty({ description: 'Action key', example: 'REPLY_WITH_ORDER_STATUS' })
    @IsNotEmpty()
    @IsString()
    actionKey: string;

    @ApiProperty({ description: 'Action configuration', example: { apiUrl: 'agagaga', orderIdField: 'agagaga' } })
    @IsOptional()
    config: Record<string, any>;
}

export class UpdateTriggerWithConfigsDto {
    @ApiProperty({ type: EventConfigDto, description: 'Event configuration' })
    @ValidateNested()
    @Type(() => EventConfigDto)
    event: EventConfigDto;

    @ApiProperty({ type: [FilterConfigDto], description: 'Filter configurations' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FilterConfigDto)
    filters: FilterConfigDto[];

    @ApiProperty({ type: [ActionConfigDto], description: 'Action configurations' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ActionConfigDto)
    actions: ActionConfigDto[];
}