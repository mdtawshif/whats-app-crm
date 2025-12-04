import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';

export class Asset {

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
    
}
