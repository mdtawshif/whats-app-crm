import {
  CustomIsNotEmpty,
  CustomIsString,
} from '@/common/validators/field-validators';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @CustomIsString()
  @CustomIsNotEmpty()
  @ApiProperty()
  refresh_token: string;

  @CustomIsString()
  @CustomIsNotEmpty()
  @ApiProperty()
  access_token: string;
}
