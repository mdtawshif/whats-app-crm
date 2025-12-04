import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum S3SubFolderEnum {
  PROFILE = "profile",
  CSV_UPLOAD = "csv_upload",
}

export class S3PutSignedUrlDto {
  @ApiProperty({ description: "Type of extension" })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiProperty({ description: "Name of the file" })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: "Optional action name",
    required: false,
  })
  @IsOptional()
  @IsEnum(S3SubFolderEnum)
  actionName?: S3SubFolderEnum;
}
