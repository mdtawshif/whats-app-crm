import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator'

//checkIsInboxThreadExistsDto
export class CheckIsInboxThreadExistsDto {
  @ApiProperty()
  @IsNotEmpty()
  contactId: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  from?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  to?: string
}
