import {
  CustomIsNotEmpty,
  CustomIsString,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @CustomIsString()
  @CustomIsNotEmpty()
  @ApiProperty()
  refresh_token: string;
}
