import {
  CustomIsEnum,
  CustomIsNotEmpty,
  CustomIsNumber,
  CustomIsString
} from "@/common/validators/field-validators";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional } from "class-validator";

enum country {
  BD = "BD",
  GLOBAL = "GLOBAL"
}

export class PaymentConfigDto {
  // @CustomIsEnum(country)
  // @CustomIsNotEmpty({ message: "COUNTRY_REQUIRED" })
  // @ApiProperty()
  // country: string;

  @CustomIsNotEmpty({ message: "PLAN_UID_REQUIRED" })
  @ApiProperty()
  @CustomIsString({ message: "PLAN_UID_MUST_BE_STRING" })
  plan_id: string;

  @CustomIsNumber({ message: "BILLING_CYCLE_MUST_BE_NUMBER" })
  @ApiProperty()
  @IsOptional()
  billing_cycle?: number;

  @ApiProperty()
  @CustomIsNotEmpty({ message: "amount required" })
  amount_without_charge: number;

  @ApiProperty()
  @IsOptional()
  client_id?: string;

  @ApiProperty({ nullable: true })
  @IsOptional()
  old_customer_id: string

  @ApiProperty()
  @IsNumber()
  user_id: number

  // @ApiProperty()
  // @IsNumber()
  // team_id: number

  @ApiProperty()
  @IsBoolean()
  isSubscription: boolean

  @ApiProperty()
  @IsBoolean()
  isTrial: boolean
}
