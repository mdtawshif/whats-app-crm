// src/notifications/dto/set-token.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TokenType } from '@prisma/client';

export class SetTokenDto {
    @IsString()
    token: string;

    @IsOptional()
    @IsEnum(TokenType)
    type?: TokenType;
}