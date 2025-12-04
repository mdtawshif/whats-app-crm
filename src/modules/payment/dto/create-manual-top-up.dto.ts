import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsPositive, IsString } from "class-validator";

export class ManualTopUpDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ChangePaymentMethodDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}