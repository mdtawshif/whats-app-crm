import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class MediaUploadSignedUrlDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  filename: string;
}
