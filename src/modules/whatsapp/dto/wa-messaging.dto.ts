
import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class WaMessagingSendDto {
    @ApiProperty()
    @IsNumber()
    inboxId: bigint;

    @ApiProperty()
    @IsNumber()
    contactId: bigint;

    @ApiProperty({required: false})
    @IsNumber()
    @IsOptional()
    templateId?: bigint;

    @ApiProperty({required: false})
    @IsString()
    @IsOptional()
    message?: string;

    @ApiProperty()
    @IsNumber()
    fromWaNumber?: bigint;
}
