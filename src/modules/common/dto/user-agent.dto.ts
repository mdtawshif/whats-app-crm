import { CustomIsString } from '@/common/validators/field-validators';
import { IsOptional } from 'class-validator';

export class UserAgentDto {
  @CustomIsString()
  @IsOptional()
  ip: string; // IP address of the client

  @CustomIsString()
  @IsOptional()
  user_agent: string; // User-Agent string of the client

  @CustomIsString()
  @IsOptional()
  browser: string; // Browser name and version

  @CustomIsString()
  @IsOptional()
  os: string; // Operating system name and version

  @CustomIsString()
  @IsOptional()
  device: string; // Device name and type
}
