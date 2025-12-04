// src/modules/contacts/dto/bulk-create-contact.dto.ts
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class ContactListParamDto extends BasePaginationDto { }


export class ContactListItemDto {
  id!: number;
  number!: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}


export class AssignContactsDto {
  @ApiProperty({ description: 'Team member ID to assign contacts to' })
  @IsNumber()
  @IsNotEmpty()
  memberId: bigint;

  @ApiProperty({ description: 'List of contact IDs to assign', type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  contactIds: number[];
}

export class RemoveContactAssignmentsDto {
  @ApiProperty({ description: "Member (user) ID from whom contacts are being removed" })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  memberId: number;

  @ApiProperty({ type: [Number], description: "List of contact IDs to remove" })
  @IsArray()
  @IsNotEmpty()
  contactIds: number[];
}


export class DeleteContactDto {
  @ApiProperty({ type: [Number], description: "Array of contact IDs to delete" })
  @IsNumber({}, { each: true })
  @IsNotEmpty({ each: true })
  contactIds: number[];
}

export class AssignWaAccountsToMemberDto {
  @ApiProperty({ example: ["WABA_123456", "2911168089062645"], description: "List of WhatsApp Business account numbers/IDs" })
  @IsArray({ message: "ACCOUNTS_MUST_BE_ARRAY" })
  @ArrayNotEmpty({ message: "ACCOUNTS_CANNOT_BE_EMPTY" })
  @IsString({ each: true, message: "EACH_ACCOUNT_MUST_BE_STRING" })
  accounts: string[];
}

export class UnassignWhatsAppNumberDto {
  @ApiProperty({
    description: 'List of WhatsApp Business account numbers or IDs to unassign',
    example: ['PN_123456', 'PN_987654'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  accounts: string[];
}

export class GetAssignedWhatsAppNumbersDto extends BasePaginationDto {
  @ApiProperty({ example: 123, description: 'Member ID whose assigned numbers you want to view' })
  @Type(() => Number)
  @IsNumber()
  memberId: number;
}