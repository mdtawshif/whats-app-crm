import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreatePersonalizationDto {

    @ApiProperty({ example: 'FIRST_NAME', description: 'Personalization key (e.g., FIRST_NAME, COMPANY_NAME)' })
    @IsString()
    @IsNotEmpty()
    key: string;

    @ApiProperty({ example: 'First Name', description: 'User-friendly label for the key' })
    @IsString()
    @IsNotEmpty()
    label: string;

    @ApiProperty({ example: 'STRING', description: 'Type of personalization (TEXT, STRING, DATE, NUMBER, BOOLEAN, etc.)' })
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ example: 'John', description: 'Actual personalized value', required: false })
    @IsString()
    @IsOptional()
    value?: string;

}
