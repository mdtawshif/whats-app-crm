import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsNumber } from "class-validator";

export class AssignTagSingleDto {
  @ApiProperty({ description: 'Contact ID' })
  @IsNotEmpty()
  contactId: bigint;

  @ApiProperty({ description: 'Array of Tag IDs' })
  @IsArray()
  tagIds: bigint[];
}

export class AssignTagMultipleDto {
  @ApiProperty({ description: 'Array of Contact IDs' })
  @IsArray()
  @IsNumber({}, { each: true })
  contactIds: number[];

  @ApiProperty({ description: 'Array of Tag IDs' })
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds: number[];
}

export class RemoveTagDto {
  @ApiProperty({ description: "Contact ID" })
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  contactIds: number[];

  @ApiProperty({ description: "Tag ID to remove" })
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  tagIds: number[];
}