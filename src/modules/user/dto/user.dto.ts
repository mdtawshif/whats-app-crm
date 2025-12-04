
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CustomIsString } from '../../../common/validators/field-validators';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

export class LoggedInUser {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  @Type(() => Number)
  id: bigint;
}

export enum UserStatusFilter {
  All = 'all',
  Paid = 'paid',
  Trial = 'trial',
  IncompleteRegisterUser = 'incomplete',
}

export class UserQueryFilterDto {
  @ApiProperty()
  @IsEnum(UserStatusFilter, {
    message: 'Status must be one of: all, paid, trial, incomplete',
  })
  status: UserStatusFilter;

  @CustomIsString({ message: 'SEARCH_KEY_MUST_BE_STRING' })
  @IsOptional()
  @ApiProperty({ required: false })
  query?: string; // SearchKey

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  })
  perPage?: number;

  @IsOptional()
  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  })
  page?: number;
}

export class ActivateUserDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ required: true })
  userId: number;
}

export class RequestUser {

  @ApiProperty()
  id: bigint;

  @ApiProperty()
  parentUserId: bigint | null;

  @ApiProperty()
  packageId: bigint | null;

  @ApiProperty()
  agencyId: bigint | null;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  currentCredit: number;

  @ApiProperty()
  email: string;

  @ApiProperty()
  apiKey: string | null;

}

export class BasicUser {

  @ApiProperty()
  id: bigint;

  @ApiProperty()
  parentUserId: bigint | null;

  @ApiProperty()
  agencyId: bigint | null;

  @ApiProperty()
  status: UserStatus;

}
