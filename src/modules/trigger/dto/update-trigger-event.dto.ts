import { PartialType } from '@nestjs/mapped-types';
import { CreateTriggerEventDto } from './create-trigger-event.dto';

export class UpdateTriggerEventDto extends PartialType(CreateTriggerEventDto) { }