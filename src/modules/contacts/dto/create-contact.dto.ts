// src/modules/contacts/dto/create-contact.dto.ts
import { IsString, IsOptional, IsEnum, ValidateNested, IsInt, ValidateIf, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContactCustomField, ContactStatus, NumberStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';


export class ContactCustomFields {
  @ApiProperty({ example: 5, description: 'Custom field ID' })
  @IsInt()
  id: number;

  @ApiProperty({
    example: 'true',
    description: 'Custom field value — any primitive but stored as string',
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convert everything (boolean, number, etc.) → string
    if (value === null || value === undefined) return '';
    return String(value);
  })
  @IsString()
  value: string;
}
export class CreateContactDto {
  @ApiProperty({ example: '+1234567890', description: 'Phone number of the contact' })
  @IsString()
  number: string;

  sourceId?: bigint;

  @ApiProperty({ example: 'John', required: false, description: 'First name of the contact' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false, description: 'Last name of the contact' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'john.doe@example.com', required: false, description: 'Email of the contact' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 'New York', required: false, description: 'City of the contact' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'NY', required: false, description: 'State of the contact' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'USA', required: false, description: 'Country of the contact' })
  @IsOptional()
  @IsString()
  country?: string;

  //countryCode
  @ApiProperty({ example: '+1', required: false, description: 'Country code of the contact' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiProperty({ example: '123 Main St', required: false, description: 'Address of the contact' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: ContactStatus.ACTIVE, enum: ContactStatus, required: false })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  //@ApiProperty({ example: NumberStatus.ACTIVE, enum: NumberStatus, required: false })
  @IsOptional()
  @IsEnum(NumberStatus)
  numberStatus?: NumberStatus;


  // contactCustomField is an array of custom fields
  @ApiProperty({ type: () => [ContactCustomFields], required: false, description: 'Custom fields for the contact' })
  @IsOptional()
  @Type(() => ContactCustomFields)
  // @ValidateNested({ each: true })
  contactCustomField?: ContactCustomField[];

  //birthDate optional
  @ApiProperty({ example: '1990-01-01', required: false, description: 'Birth date of the contact' })
  @IsOptional()
  @IsString()
  birthDate?: string;
  //anniversaryDate
  @ApiProperty({ example: '2023-06-15', required: false, description: 'Anniversary date of the contact' })
  @IsOptional()
  @IsString()
  anniversaryDate?: string;
}