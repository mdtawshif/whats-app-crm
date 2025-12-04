import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class User {

    @ApiProperty({ type: Number, example: 1 })
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    id: number;

    permissions: Record<string, Record<string, boolean>> | [];

    roleName: string | null;

    userName: string | null;

}