import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ForgetPasswordDto } from './forget-password.dto';
import {
  CustomIsEmail,
  CustomIsNotEmpty,
  CustomIsString,
  CustomMinLength,
} from '@/common/validators/field-validators';

export class ResetPasswordDto {
  @CustomIsString()
  @ApiProperty()
  code: string;

  @CustomIsEmail()
  @ApiProperty()
  email: string;

  @CustomMinLength(6)
  @ApiProperty()
  new_password: string;

  @ApiProperty()
  @CustomIsNotEmpty()
  agency_id: string;

  @CustomIsString()
  @IsOptional()
  @ApiProperty({ required: false })
  team_uid: string;
}
