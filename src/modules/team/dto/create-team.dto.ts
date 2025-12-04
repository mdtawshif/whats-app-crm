import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
  PENDING = "PENDING",
  NEED_TO_RESET_CREDENTIAL = "NEED_TO_RESET_CREDENTIAL"
}

export enum TeamMemberRole {
  MEMBER = "MEMBER",
  LEADER = "LEADER",
}

export class AddTeamMemberDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  user_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: TeamMemberRole })
  @IsNotEmpty()
  @IsEnum(TeamMemberRole)
  role: TeamMemberRole;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  teamId: number;

  @IsEnum(UserStatus)
  @IsOptional()
  status: UserStatus;


  @ApiProperty()
  @IsOptional()
  @IsString()
  timezone?: string;

}

export class CreateTeamDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTeamDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(190, { message: "Description must be at least 190 characters long" })
  description?: string;
}

export class GetTeamMembersDto {
  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  perPage?: number = 10;

  @ApiProperty({ required: false }) @IsString()
  @IsOptional()
  sortOn?: string;

  @ApiProperty({ required: false }) @IsString()
  @IsOptional()
  sortDirection?: "asc" | "desc";

  @ApiProperty({ required: false }) @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  needPagination?: boolean = false;

  @ApiProperty({ required: true, description: "Team ID to fetch members" })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  teamId: bigint;
}


export class GetTeamListDto {
  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  perPage?: number = 10;

  @ApiProperty({ required: false }) @IsString()
  @IsOptional()
  sortOn?: string;

  @ApiProperty({ required: false }) @IsString()
  @IsOptional()
  sortDirection?: "asc" | "desc";

  @ApiProperty({ required: false }) @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  needPagination?: boolean = false;
}


// GetSegmentsDto
export class GetSegmentsDto {

  // userId
  @ApiProperty({ example: 1, required: false, description: 'User ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  userId?: number;

  // page
  @ApiProperty({ example: 1, required: false, description: 'Page number for pagination' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;


  // limit
  @ApiProperty({ example: 10, required: false, description: 'Number of contacts per page' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;


  // name
  @ApiProperty({ example: 'Segment Name', required: false, description: 'Filter by segment name' })
  @IsOptional()
  @IsString()
  name?: string;

  // status
  @ApiProperty({ example: 'ACTIVE', required: false, description: 'Filter by segment status' })
  @IsOptional()
  @IsString()
  status?: string;


  // sortBy
  @ApiProperty({ example: 'name', required: false, description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';


  // sortOrder
  @ApiProperty({ example: 'asc', required: false, description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}