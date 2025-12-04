import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class CustomFieldParamDto extends BasePaginationDto {

}

export class CustomFieldListItemDto {

  @ApiProperty({ example: 1, description: 'Unique ID of the personalization record' })
  id: bigint;

  @ApiProperty({ example: 1, description: 'User ID who owns this personalization' })
  userId?: bigint;

  @ApiProperty({ example: 1, description: 'Agency ID associated with this personalization' })
  agencyId?: bigint;

  @ApiProperty({ example: 2, description: 'Team ID associated with this personalization (nullable)', required: false })
  teamId?: bigint;

  @ApiProperty({ example: 'First Name', description: 'User-friendly label for the key' })
  label: string;

  @ApiProperty({ example: 'STRING', description: 'Type of personalization (TEXT, STRING, DATE, NUMBER, BOOLEAN, etc.)' })
  type: string;

  @ApiProperty({ example: 'STRING', description: 'Type of personalization (TEXT, STRING, DATE, NUMBER, BOOLEAN, etc.)', required: false })
  defaultValue?: string;

  @ApiProperty({ required: false })
  createdAt?: Date;
}
