import { IsEnum, IsOptional, IsDate, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { TriggerEventExecutionLogStatus } from '@prisma/client';
import { EventKeys, ActionKeys } from 'src/types/triggers';

export class EventExecutionLogDto {
    @IsNotEmpty()
    triggerId: bigint;

    @IsNotEmpty()
    contactId: bigint | bigint[];

    @IsNotEmpty()
    agencyId: bigint;

    @IsNotEmpty()
    userId: bigint;

    @IsEnum(EventKeys)
    @IsNotEmpty()
    eventKey: EventKeys;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    executionDate?: Date



    @IsEnum(TriggerEventExecutionLogStatus)
    @IsNotEmpty()
    status: TriggerEventExecutionLogStatus;

    @IsString()
    @IsOptional()
    error?: string;
}

export class EventActionExecutionLogDto extends EventExecutionLogDto {
    @IsEnum(ActionKeys)
    @IsNotEmpty()
    actionKey: ActionKeys;

    @IsEnum(TriggerEventExecutionLogStatus)
    @IsNotEmpty()
    status: TriggerEventExecutionLogStatus;

    @IsString()
    @IsOptional()
    error?: string;
}


