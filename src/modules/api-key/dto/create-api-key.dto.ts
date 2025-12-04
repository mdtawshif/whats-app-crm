import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateApiKeyDto {
    @ApiProperty({ description: 'The ID of the user for whom to generate the API key', example: '123456789' })
    @IsString()
    @IsNotEmpty()
    userId: number;
}