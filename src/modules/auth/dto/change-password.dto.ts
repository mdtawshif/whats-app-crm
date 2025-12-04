import {
  CustomIsNotEmpty,
  CustomMinLength,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @CustomIsNotEmpty({ message: 'Please Enter Old Password' })
  old_password: string;

  @ApiProperty()
  @CustomIsNotEmpty({ message: 'Please Enter New Password' })
  @CustomMinLength(8, {
    message: 'New password must be at least 8 characters long',
  })
  new_password: string;

  @ApiProperty()
  @CustomIsNotEmpty({ message: 'Please Confirm New Password' })
  confirm_password: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Please provide your email' })
  email: string;
}
