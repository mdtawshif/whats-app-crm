// src/modules/contacts/dto/create-segment.dto.ts
import { IsString, IsObject, IsOptional, IsNotEmpty, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export interface Filters {
    contactIds?: string[];
    status?: string[];
    tags?: string[];
    dateRange?: {
        field: string;
        from?: string;
        to?: string;
    };
    searchQuery?: string;
}

export class CreateSegmentDto {
    @ApiProperty({ example: 'High Value Customers', description: 'Name of the segment' })
    @IsString()
    @IsNotEmpty({ message: 'Segment name is required' })
    name: string;

    // filters is json object with various filter criteria
    @ApiProperty({ example: '{"status": "active"}', description: 'Filters for the segment' })
    @IsObject()
    @IsOptional()
    filters?: Filters;
}


// update-segments

export class UpdateSegmentDto {
    @ApiProperty({ example: 'High Value Customers', description: 'Name of the segment' })
    @IsString()
    @IsOptional()
    name?: string;

    // filters is json object with various filter criteria
    @ApiProperty({ example: '{"status": "active"}', description: 'Filters for the segment' })
    @IsObject()
    @IsOptional()
    filters?: Filters;
}


export class GetSegmentsDto {
    @ApiProperty({ example: 1, description: 'Page number', required: false })
    @IsNumber()
    @IsOptional()
    page?: number;

    @ApiProperty({ example: 10, description: 'Number of items per page', required: false })
    @IsNumber()
    @IsOptional()
    limit?: number;

    @ApiProperty({ example: 'Active List', description: 'Segment name filter', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ example: 'ACTIVE', description: 'Status filter', required: false })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiProperty({ example: 'name', description: 'Field to sort by', required: false })
    @IsString()
    @IsOptional()
    sortBy?: string;

    @ApiProperty({ example: 'desc', description: 'Sort order', enum: ['asc', 'desc'], required: false })
    @IsEnum(['asc', 'desc'])
    @IsOptional()
    sortOrder?: 'asc' | 'desc';
}

// bulk delete contacts from segment with array of contactIds
export class BulkDeleteContactsDto {
    @ApiProperty({ example: ['123', '456'], description: 'Array of contact IDs to delete from segment' })
    @IsString({ each: true })
    @IsNotEmpty({ message: 'Contact IDs array cannot be empty' })
    contactIds: string[];
}

// bulk add more contacts to segment with array of contactIds
export class BulkAddContactsDto {
    @ApiProperty({ example: ['123', '456'], description: 'Array of contact IDs to add to segment' })
    @IsString({ each: true })
    @IsNotEmpty({ message: 'Contact IDs array cannot be empty' })
    contactIds: string[];
}

// get contacts by segment id with pagination
export class GetContactsBySegmentIdDto {
    @ApiProperty({ example: 1, description: 'Page number', required: false })
    @IsString()
    @IsOptional()
    page?: string;


    @ApiProperty({ example: 10, description: 'Number of items per page', required: false })
    @IsString()
    @IsOptional()
    limit?: string;

    @ApiProperty({ example: 'name', description: 'Field to sort by', required: false })
    @IsString()
    @IsOptional()
    sortBy?: string;

    @ApiProperty({ example: 'desc', description: 'Sort order', enum: ['asc', 'desc'], required: false })
    @IsEnum(['asc', 'desc'])
    @IsOptional()
    sortOrder?: 'asc' | 'desc';

    // search query to filter contacts
    @ApiProperty({ example: 'John Doe', description: 'Search query to filter contacts', required: false })
    @IsString()
    @IsOptional()
    searchQuery?: string;
}