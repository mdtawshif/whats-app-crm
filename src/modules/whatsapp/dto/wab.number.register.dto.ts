// import { Expose } from 'class-transformer';
// import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// export class WabNumberRegisterRequest {
//   @IsString()
//   @IsNotEmpty()
//   @Expose({ name: 'cc' })
//   cc: string;

//   @IsString()
//   @IsNotEmpty()
//   @Expose({ name: 'phoneNumber' })
//   phone_number: string;

//   @IsString()
//   @IsNotEmpty()
//   @Expose({ name: 'verifiedName' })
//   verified_name: string;

//   @IsString()
//   @IsNotEmpty()
//   @Expose({ name: 'wabaId' })
//   waba_id: string;
// }


export class GetAllNumberShortDto {

  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  wabaId: string

}

export class WaNumberDto {
  @ApiProperty({
    description: 'Record ID (serialized as string to avoid BigInt issues)',
    example: '1234567890123456',
    type: String,
  })
  @Transform(({ value }) => (value !== undefined && value !== null ? String(value) : value), {
    toClassOnly: true,
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'WhatsApp phone_number_id from Meta',
    example: '123456789012345',
  })
  @IsString()
  phoneNumberId!: string;

  @ApiPropertyOptional({
    description: 'Human-friendly phone number (may be E.164, e.g. +15551234567)',
    example: '+15551234567',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  displayPhoneNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Raw number if stored separately',
    example: '5551234567',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  number?: string | null;
}
