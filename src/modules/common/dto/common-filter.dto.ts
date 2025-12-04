import {
  CustomIsArray,
  CustomIsBoolean,
  CustomIsEnum,
  CustomIsString,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class VirtualFilterDto {
  @CustomIsString({ message: 'SEARCH_KEY_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  query?: string; // SearchKey

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') value = Number(value);
    return isNaN(value) ? 10 : value; // 👈 default to 10
  })
  perPage?: number;

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') value = Number(value);
    return isNaN(value) ? 1 : value; // 👈 default to 1
  })
  page?: number;

  @CustomIsString({ message: 'SORT_DIRECTION_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  @CustomIsEnum(SortDirection, { message: 'INVALID_SORT_DIRECTION' })
  sortDirection?: string;

  @CustomIsString({ message: 'SORT_ON_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  sortOn?: string;

  @CustomIsBoolean()
  @CustomIsBoolean()
  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => value === 'true' || value === true)
  needPagination?: boolean;

  @CustomIsString({ message: 'STATUS_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  status?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  })
  callFlowId?: number;

  @CustomIsString({ message: 'SEARCH_KEY_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  campaignName?: string; // campaignName
}

export class CommonFilterDto {
  @CustomIsString({ message: 'SEARCH_KEY_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  query?: string; // SearchKey

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  })
  perPage?: number;

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  })
  page?: number;

  @CustomIsString({ message: 'SORT_DIRECTION_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  @CustomIsEnum(SortDirection, { message: 'INVALID_SORT_DIRECTION' })
  sortDirection?: string;

  @CustomIsString({ message: 'SORT_ON_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  sortOn?: string;

  @CustomIsBoolean()
  @CustomIsBoolean()
  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => value === 'true' || value === true)
  needPagination?: boolean;

  @CustomIsString({ message: 'STATUS_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  status?: string;

  @CustomIsArray()
  @CustomIsArray()
  @IsOptional()
  @ApiProperty({ required: false })
  withoutIds?: any[];
}

export class CallFlowFilterDto {
  @CustomIsString({ message: 'SEARCH_KEY_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  query?: string; // SearchKey

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') value = Number(value);
    return isNaN(value) ? 10 : value; // 👈 default to 10
  })
  perPage?: number;

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') value = Number(value);
    return isNaN(value) ? 1 : value; // 👈 default to 1
  })
  page?: number;

  @CustomIsString({ message: 'SORT_DIRECTION_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  @CustomIsEnum(SortDirection, { message: 'INVALID_SORT_DIRECTION' })
  sortDirection?: string;

  @CustomIsString({ message: 'SORT_ON_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  sortOn?: string;

  @CustomIsBoolean()
  @CustomIsBoolean()
  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => value === 'true' || value === true)
  needPagination?: boolean;

  @CustomIsString({ message: 'STATUS_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  status?: string;
}
