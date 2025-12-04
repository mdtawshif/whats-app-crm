// backend/src/modules/contacts/dto/upload-contact.dto.ts
import {
    IsString,
    IsNumber,
    IsEnum,
    IsObject,
    IsBoolean,
    IsOptional,
    ValidateNested,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FileType } from '@prisma/client';

// TagMappingDto
export class TagMappingDto {
    @IsString()
    @IsOptional()
    csvField: string;

    @IsNumber()
    @IsOptional()
    csvFieldIndex: number;

    @IsString()
    @IsOptional()
    contactField: string; // Should be "tags"

    @IsString()
    @IsOptional()
    label?: string;

    //isRequired?: boolean;

    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;
}

// CustomFieldMappingDto
export class CustomFieldMappingDto {
    @IsString()
    @IsOptional()
    csvField: string;

    @IsNumber()
    @IsOptional()
    csvFieldIndex: number;

    @IsString()
    @IsOptional()
    contactField: string;

    @IsString()
    @IsOptional()
    customFieldId?: string;

    @IsString()
    @IsOptional()
    label?: string;

    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;
}

// ContactMappingDto
export class ContactMappingDto {
    @IsString()
    @IsOptional()
    csvField: string;

    @IsNumber()
    @IsOptional()
    csvFieldIndex: number;

    @IsString()
    @IsOptional()
    contactField: string;

    @IsString()
    @IsOptional()
    label?: string;

    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;
}

// GoogleSheetsConfigDto
export class GoogleSheetsConfigDto {
    @IsString()
    @IsOptional()
    sheetUrl?: string;

    @IsString()
    @IsOptional()
    sheetId?: string;

    @IsString()
    @IsOptional()
    worksheetName?: string;
}

// ConfigsDto
export class ConfigsDto {
    @IsObject()
    @IsOptional()
    @ValidateNested()
    @Type(() => GoogleSheetsConfigDto)
    googleSheetsConfig?: GoogleSheetsConfigDto | null;

    @IsBoolean()
    @IsOptional()
    skipDuplicates?: boolean = false;

    @IsBoolean()
    @IsOptional()
    updateExisting?: boolean = false;

    @IsBoolean()
    @IsOptional()
    hasHeaders: boolean = true;
}

// FieldMappingsDto - Updated to include tagMappings
export class FieldMappingsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ContactMappingDto)
    contactMappings: ContactMappingDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomFieldMappingDto)
    customFieldMappings: CustomFieldMappingDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TagMappingDto)
    tagMappings: TagMappingDto[];

    @IsObject()
    @ValidateNested()
    @Type(() => ConfigsDto)
    configs: ConfigsDto;
}

// UploadContactsDto - Updated to use FieldMappingsDto
export class UploadContactsDto {
    @IsString()
    @IsOptional()
    fileUrl: string;

    @IsString()
    @IsOptional()
    fileName: string;

    @IsEnum(FileType)
    @IsOptional()
    fileType: FileType;

    @IsObject()
    @ValidateNested()
    @Type(() => FieldMappingsDto)
    fieldMappings: FieldMappingsDto;

    @IsString()
    @IsOptional()
    defaultCountry: string;

    @IsString()
    @IsOptional()
    defaultCountryCode: string;

    @IsBoolean()
    @IsOptional()
    hasHeaders: boolean = true;
}