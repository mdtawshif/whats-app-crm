// src/modules/s3/dtos/generate-presigned-url.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';

export enum PresignedUrlOperation {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
}

export class GeneratePresignedUrlDto {
  @ApiProperty({ description: 'The key (path) for the file in S3' })
  @IsString()
  key: string;

  @ApiProperty({ enum: PresignedUrlOperation, description: 'Operation type: upload or download' })
  @IsEnum(PresignedUrlOperation)
  operation: PresignedUrlOperation;

  @ApiProperty({ description: 'Optional bucket name (defaults to config value)', required: false })
  @IsString()
  @IsOptional()
  bucket?: string;

  @ApiProperty({ description: 'Content type for upload (e.g., image/jpeg)', required: false })
  @IsString()
  @IsOptional()
  contentType?: string;
}





export enum S3SubFolderEnum {
  PROFILE = "public",
  LEAVE_DOC = "private"
}

export class S3PutSignedUrlDto {
  @ApiProperty({ description: "Type of extension" })
  @IsString()
  @IsNotEmpty()
  extensionType: string;

  @ApiProperty({ description: "Name of the file" })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: "Optional action name"
  })
  @IsOptional()
  @IsEnum(S3SubFolderEnum)
  actionName?: S3SubFolderEnum;
}