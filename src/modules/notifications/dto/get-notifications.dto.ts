import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { NotificationType } from '@prisma/client'; // assuming you have this enum in Prisma

export class GetNotificationsDto {
    @IsOptional()
    @IsString()
    query?: string;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;

    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType;

    @IsOptional()
    @IsString()
    read?: string;
}
