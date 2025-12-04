import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsInt, Min, IsString, IsBoolean } from 'class-validator';

export class BasePaginationDto {
  @ApiProperty({ required: false, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  perPage: number = 10;

  @ApiProperty({ required: false, example: "createdAt" })
  @IsString()
  @IsOptional()
  sortOn?: string;

  @ApiProperty({ required: false, enum: ["asc", "desc"], example: "asc" })
  @IsString()
  @IsOptional()
  sortDirection?: "asc" | "desc";

  @ApiProperty({ required: false, example: "search text" })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  needPagination: boolean = false;
}
