import { ApiProperty } from '@nestjs/swagger';
import { CyclePeriod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum PackageStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}


export class BillingPackageRequestDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  id: number;
}

export class CreateBillingPackageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PackageStatus, default: PackageStatus.ACTIVE })
  @IsEnum(PackageStatus)
  @IsOptional()
  status?: PackageStatus;

  @ApiProperty({ enum: CyclePeriod })
  @IsEnum(CyclePeriod)
  cyclePeriod: CyclePeriod;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  chargeAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPerVirtualNumber?: number = 0;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPerCallMinute?: number = 0;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  allowNegativeBalance?: number = 0;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  trialFreeCredit?: number = 0;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  maxUser?: number = 0;

  @ApiProperty()
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateBillingPackageDto extends CreateBillingPackageDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  id: number;
}

export class DeleteBillingPackageDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  id: number;
}



export interface BillingTransactionResponse {
  id: number;
  chargeAmount: number;
  chargeType: 'Outgoing Message' | 'Incoming Message';
  chargePurpose: string;
  chargeNote: string | null;
  chargedAt: Date;
}