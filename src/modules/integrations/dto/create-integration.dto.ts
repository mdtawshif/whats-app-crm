// dto/create-integration.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IntegrationType } from '@prisma/client';

export class CreateIntegrationDto {
    @IsEnum(IntegrationType)
    type: IntegrationType;

    @IsOptional()
    @IsString()
    name?: string;
}