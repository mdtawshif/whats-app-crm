import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray } from 'class-validator';

export class GoogleSheetMetadataResponseDto {
    @ApiProperty({ description: 'The unique ID of the Google Sheet' })
    @IsString()
    spreadsheetId: string;

    @ApiProperty({ description: 'The title of the Google Sheet' })
    @IsString()
    title: string;

    @ApiProperty({ description: 'List of worksheet names in the Google Sheet' })
    @IsArray()
    @IsString({ each: true })
    sheetNames: string[];
}