import {
  CustomIsBoolean,
  CustomIsEmail,
  CustomIsLowercase,
  CustomIsNotEmpty,
  CustomMinLength,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class registerUserDto {
  @IsOptional()
  @ApiProperty()
  user_name?: string;

  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomIsEmail()
  @CustomIsLowercase()
  email: string;

  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomMinLength(8)
  password: string;
}
// For manual registration (keep password required)
export class RegisterUserDto {
  @IsOptional()
  @ApiProperty()
  user_name?: string;

  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomIsEmail()
  @CustomIsLowercase()
  email: string;

  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomMinLength(8)
  password: string;
}

// For Google registration (password optional)
export class GoogleRegisterUserDto {
  @IsOptional()
  @ApiProperty()
  user_name?: string;

  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomIsEmail()
  @CustomIsLowercase()
  email: string;

  @IsOptional()
  @ApiProperty({ required: false })
  password?: string; // Google users don’t need a password
}


export class hashPasswordDto {
  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomMinLength(6)
  password: string;
}
