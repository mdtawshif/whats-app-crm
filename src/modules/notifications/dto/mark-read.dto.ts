// src/notifications/dto/mark-read.dto.ts
import { IsBoolean } from 'class-validator';

export class MarkReadDto {
    @IsBoolean()
    read: boolean;
}