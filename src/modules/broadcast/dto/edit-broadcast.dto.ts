import { ApiProperty } from "@nestjs/swagger";
import { PartialType } from '@nestjs/swagger';
import { BroadcastStatus } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { CreateBroadcastDto } from './create-broadcast.dto';

export class UpdateBroadcastDto extends PartialType(CreateBroadcastDto) {

  @ApiProperty({ enum: BroadcastStatus, required: false })
  @IsEnum(BroadcastStatus)
  @IsOptional()
  status?: BroadcastStatus;

}

export class DeleteBroadcastDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  id: number;
}