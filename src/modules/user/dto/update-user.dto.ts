import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateUserProfileDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  id: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  user_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  last_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  team_name: string;
}

export enum AutoRechargeStatus {
  YES = 'YES',
  NO = 'NO',
}
export class AutoRechargeDto {
  @ApiProperty()
  @IsOptional()
  @IsEnum(AutoRechargeStatus)
  autoRecharge?: AutoRechargeStatus;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  autoRechargeAmount?: number;

  @ApiProperty()
  @IsOptional()
  minimumCreditThreshold?: number;
}

export class AutoRechargeSettingsDto {
  @ApiProperty()
  @IsOptional()
  @Type(() => Boolean)
  isAutoRecharge: boolean;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  autoRechargeAmount: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  minimumCreditThreshold: number;
}
