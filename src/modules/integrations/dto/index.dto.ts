import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GoogleSheetItemDto {
    @ApiProperty({ example: 'sheet_123' })
    @IsString()
    id: string;

    @ApiProperty({ example: 'Customer Data' })
    @IsString()
    name: string;

    @ApiProperty({ required: false, example: '2025-08-20T10:00:00Z' })
    @IsOptional()
    @IsString()
    modifiedTime?: string;
}

// Query params DTO
export class GoogleSheetQueryDto {
    @ApiProperty({ required: false, example: 1, description: 'Page number (default: 1)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false, example: 10, description: 'Limit per page (default: 10)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @ApiProperty({ required: false, example: 'Sheet Name', description: 'Search by sheet name' })
    @IsOptional()
    @IsString()
    search?: string;
}

// Response DTO
export class GoogleSheetListResponseDto {
    @ApiProperty({ type: [GoogleSheetItemDto] })
    sheets: GoogleSheetItemDto[];

    @ApiProperty({ example: 50 })
    total: number;

    @ApiProperty({ example: 20 })
    filteredTotal: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 10 })
    limit: number;

    @ApiProperty({ example: 5 })
    totalPages: number;

    @ApiProperty({ required: false, example: 'Sheets fetched successfully' })
    message?: string;
}

// Body DTO
export class GenerateCsvUrlDto {
    @ApiProperty({
        description: 'Google Sheet URL or spreadsheet ID',
        example: 'https://docs.google.com/spreadsheets/d/abc123...',
    })
    @IsString()
    input: string;

    @ApiProperty({ description: 'Integration ID associated with the Google Sheet', example: 1 })
    integrationId: bigint;

}
