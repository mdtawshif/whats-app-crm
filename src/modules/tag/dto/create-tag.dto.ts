// src/modules/tags/dto/create-tag.dto.ts
import { BasePaginationDto } from "@/common/dto/base-pagination.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateTagDto {
  @ApiProperty({ example: "VIP Customer" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "High priority clients", required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTagDto {
  @ApiProperty({ example: "VIP Customer" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "High priority clients", required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class TagListParamDto extends BasePaginationDto {

}
export class TagListItemDto {
    
    @ApiProperty()
    id: bigint;

    @ApiProperty({ required: true })
    title: string;

    @ApiProperty()
    agencyId: bigint;

    @ApiProperty()
    userId: bigint;

    @ApiProperty()
    createdBy?: bigint;

    @ApiProperty()
    description?: string;

    @ApiProperty({ required: false })
    createdAt?: Date;
}