import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';

export class Permission {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
}
