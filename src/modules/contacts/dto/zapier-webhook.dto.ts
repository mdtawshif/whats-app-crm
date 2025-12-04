// src/modules/contacts/dto/zapier-webhook.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, ValidateNested, IsArray, IsNotEmpty } from 'class-validator';
import { CreateContactDto } from './create-contact.dto';
import { BulkCreateContactDto } from './bulk-create-contact.dto';

export class ZapierWebhookDto {
    @ApiPropertyOptional({
        description: 'API key for authentication',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    @IsOptional()
    apiKey?: string;

    @ApiPropertyOptional({
        description: 'User ID associated with the webhook request',
        example: '1',
    })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Agency ID associated with the webhook request',
        example: '1',
    })
    @IsString()
    @IsOptional()
    agencyId?: string;

    @ApiPropertyOptional({
        description: 'Team ID associated with the webhook request',
        example: '1',
    })
    @IsString()
    @IsOptional()
    teamId?: string;

    @ApiProperty({
        description: 'Single contact or array of contacts to create',
        type: () => [CreateContactDto, BulkCreateContactDto],
        oneOf: [
            { $ref: '#/components/schemas/CreateContactDto' },
            { $ref: '#/components/schemas/BulkCreateContactDto' },
        ],
    })
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => Object, {
        discriminator: {
            property: 'contacts',
            subTypes: [
                { value: BulkCreateContactDto, name: 'bulk' },
                { value: CreateContactDto, name: 'single' },
            ],
        },
    })
    data: CreateContactDto | BulkCreateContactDto;
}