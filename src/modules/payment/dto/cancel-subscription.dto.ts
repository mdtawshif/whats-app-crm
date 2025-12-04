import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CancelSubscriptionDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    userPackageId: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    cancelType: 'now' | 'end_of_cycle';

    @ApiProperty()
    @IsString()
    @IsOptional()
    message?: string;
}