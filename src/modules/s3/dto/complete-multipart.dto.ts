import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

export class CompletedPartDto {
  @IsString()
  @IsOptional()
  @ApiProperty()
  etag?: string;

  @IsNumber()
  @ApiProperty()
  partNumber: number;
}

export class CompleteMultipartDto {
  @IsString()
  @ApiProperty()
  filePath: string;

  @IsString()
  @ApiProperty()
  uploadId: string;

  @IsDefined()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  @ApiProperty({ type: CompletedPartDto, isArray: true })
  completedParts: CompletedPartDto[];
}
