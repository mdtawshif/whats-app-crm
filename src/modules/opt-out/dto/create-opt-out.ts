import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class AddContactsToOptOutDto {
    @Type(() => Number)
    @ApiProperty({ description: 'Contact IDs', type: [Number] })
    @IsArray()
    @ArrayNotEmpty()
    // @IsNumber({}, { each: true })
    contactIds: number[] | string[]

    @ApiProperty({ example: 'Spam', description: 'Reason for opt-out', required: false })
    @IsString()
    @IsOptional()
    reason?: string;
}


export class RemoveContactsFromOptOutDto {
    @Type(() => Number)
    @ApiProperty({ description: 'Contact IDs', type: [Number] })
    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, { each: true })
    contactIds: number[]
}

export class GetOptOutContactsDto {
    @ApiProperty({ example: 1, required: false, description: 'Page number for pagination' })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    page?: number = 1;

    @ApiProperty({ example: 10, required: false, description: 'Number of contacts per page' })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    limit?: number = 10;

    @ApiProperty({ example: '+1234567890', required: false, description: 'Filter by phone number' })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty({ example: 'John', required: false, description: 'Filter by name' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({ example: 'Doe', required: false, description: 'Filter by last name' })
    @IsOptional()
    @IsString()
    lastName?: string;

    // email
    @ApiProperty({ example: 'john.doe@example.com', required: false, description: 'Filter by email' })
    @IsOptional()
    @IsString()
    email?: string;

    @ApiProperty({ example: 'number', required: false, description: 'Sort by field' })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiProperty({ example: 'asc', required: false, description: 'Sort order' })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc' = 'desc';

}