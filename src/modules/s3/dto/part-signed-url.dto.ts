import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class PartSignedUrlDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  uploadId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  filePath: string;

  @IsNumber()
  @ApiProperty()
  partNumber: number;
}
