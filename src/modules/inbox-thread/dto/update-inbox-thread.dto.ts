import { PartialType } from '@nestjs/swagger';
import { CreateInboxThreadDto } from './create-inbox-thread.dto';

export class UpdateInboxThreadDto extends PartialType(CreateInboxThreadDto) { }