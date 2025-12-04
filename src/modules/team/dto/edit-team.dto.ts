import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";
import { UserStatus } from "./create-team.dto";
import { Type } from "class-transformer";
import { TeamMemberStatus, TeamRole } from "@prisma/client";

export enum UserRole {
  ADMIN = "ADMINISTRATOR",
  MANAGER = "MANAGER"
}
export class UpdateTeamMemberDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  id: Number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: TeamRole, required: false })
  @IsEnum(TeamRole)
  @IsOptional()
  teamRole?: TeamRole;
}

export class AdminTeamMemberQueryDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  @Type(() => Number)
  userId: Number;
}

export class DeleteTeamMemberDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  id: Number;
}

export class MemberAssingVirtualNumberDto {
  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  memberId: Number;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  virtualNumberId: Number;
}

export class BulkMemberAssignVirtualNumbersDto {
  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  memberId: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  virtualNumberIds: number[];
}

export class MemberUnAssignVirtualNumberDto {
  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  memberId: number;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  virtualNumberId: number;
}


export class GetVirtualNumbersQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  memberId?: string;
}

export class DeleteTeamDto{
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  id: number;
}
