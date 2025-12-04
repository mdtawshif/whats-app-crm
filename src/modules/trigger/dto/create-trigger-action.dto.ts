import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTriggerActionDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    key: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;


    @ApiProperty({ required: false })
    @IsOptional()
    metadata?: any;
}