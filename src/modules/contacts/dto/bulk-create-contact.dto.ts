// src/modules/contacts/dto/bulk-create-contact.dto.ts
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';

export class BulkCreateContactDto {
    @ApiProperty({ type: [CreateContactDto], description: 'Array of contacts to create' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateContactDto)
    contacts: CreateContactDto[];
}