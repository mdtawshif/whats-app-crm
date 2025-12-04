// src/modules/contacts/dto/create-custom-field.dto.ts
import { IsString, IsOptional, IsIn, IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomFieldDto {

    @ApiProperty({ type: 'string', example: "key" })
    @IsString()
    @IsNotEmpty()
    key: string;


    @ApiProperty({ type: 'string', example: "Road No." })
    @IsString()
    @IsNotEmpty()
    label: string;

    @ApiProperty({ type: 'string', example: "TEXT" })
    @IsString()
    @IsNotEmpty()
    @IsIn(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'DATE']) // Example types, adjust as needed
    type: string;

    @ApiProperty({ type: 'string', example: "123" })
    @IsString()
    @IsOptional()
    defaultValue?: string;
}

export class UpdateCustomFieldDto {

    @ApiProperty({ type: 'string', example: "key" })
    @IsString()
    @IsOptional()
    key?: string;

    @ApiProperty({ type: 'string', example: "Road No." })
    @IsString()
    @IsOptional()
    label?: string;

    @ApiProperty({ type: 'string', example: "TEXT" })
    @IsString()
    @IsOptional()
    @IsIn(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', "DATE"])
    type?: string;

    @ApiProperty({ type: 'string', example: "123" })
    @IsString()
    @IsOptional()
    defaultValue?: string;
}

export class GetCustomFieldsDto {
    @ApiProperty({ example: 1, required: false, description: 'Page number for pagination' })
    @IsInt()
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ example: 10, required: false, description: 'Number of items per page' })
    @IsInt()
    @IsOptional()
    limit?: number = 10;

    @ApiProperty({ example: "Road No.", required: false })
    @IsString()
    @IsOptional()
    label?: string;

    // type
    @ApiProperty({ example: "TEXT", required: false })
    @IsString()
    @IsOptional()
    type?: string;

    // sortBy
    @ApiProperty({ example: "createdAt", required: false })
    @IsString()
    @IsOptional()
    sortBy?: string = 'createdAt';

    // sortOrder
    @ApiProperty({ example: "asc", required: false })
    @IsString()
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';
}

