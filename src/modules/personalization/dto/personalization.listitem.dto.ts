import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class PersonalizationListParamDto extends BasePaginationDto {

}

export class PersonalizationListItemDto {

  @ApiProperty({ example: 1, description: 'Unique ID of the personalization record' })
  id: bigint;

  @ApiProperty({ example: 1, description: 'User ID who owns this personalization' })
  userId?: bigint;

  @ApiProperty({ example: 1, description: 'Agency ID associated with this personalization' })
  agencyId?: bigint;

  @ApiProperty({ example: 'FIRST_NAME', description: 'Personalization key (e.g., FIRST_NAME, COMPANY_NAME)' })
  key: string;

  @ApiProperty({ example: 'First Name', description: 'User-friendly label for the key' })
  label: string;

  @ApiProperty({ example: 'STRING', description: 'Type of personalization (TEXT, STRING, DATE, NUMBER, BOOLEAN, etc.)' })
  type: string;

  @ApiProperty({ example: 'John', description: 'Actual personalized value', required: false })
  value?: string;

}

export class PersonalizationItemDto {

  @ApiProperty({ example: 'FIRST_NAME', description: 'Personalization key (e.g., FIRST_NAME, COMPANY_NAME)' })
  key: string;

  @ApiProperty({ example: 'First Name', description: 'User-friendly label for the key' })
  label: string;

  group?: PersonalizationGroup;

}

export enum PersonalizationGroup {
  USER = 'USER',
  CONTACT = 'CONTACT',
  AGENCY = 'AGENCY',
  USER_DEFINED = 'USER_DEFINED',
}

