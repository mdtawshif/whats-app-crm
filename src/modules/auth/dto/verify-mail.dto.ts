import {
  CustomIsNotEmpty,
  CustomIsString,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendVerificationCodeDto {
  @ApiProperty()
  @CustomIsNotEmpty()
  @IsEmail()
  email: string;
}

export class VerifyVerificationCodeDto {
  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomIsString()
  code: string;
}
