import {
  CustomIsEmail,
  CustomIsNotEmpty,
  CustomIsString,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgetPasswordDto {
  @CustomIsEmail()
  @ApiProperty()
  email: string;

  @CustomIsString()
  @IsOptional()
  @ApiProperty()
  team_uid: string;

  @CustomIsString()
  @CustomIsNotEmpty()
  @ApiProperty()
  agency_uid: string;
}
