import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString, ValidateNested } from "class-validator";

class DataObjectDto {
  @ApiProperty({ example: '8013273053997' })
  @IsString()
  phone_number_id: string;

  @ApiProperty({ example: '2911169062645' })
  @IsString()
  waba_id: string;

  @ApiProperty({ example: '199919114645' })
  @IsString()
  business_id: string;
}

export class StartWabaIntegrationQueryDto {
    @ApiProperty()
    @IsString({
        message: "Redirect Url must be string",
    })
    redirectUrl: string;
}

export class ExchangeCodeToTokenRequestDto {
    @ApiProperty()
    @IsString({
        message: "Redirect Url must be string",
    })
    redirectUrl: string;
    
    @ApiProperty()
    @IsString({
        message: "state must be string",
    })
    state: string;

    @ApiProperty()
    @IsString({
        message: "Code must be string",
    })
    code: string;

    @ApiProperty({
        type: DataObjectDto,
        example: {
            phone_number_id: '801395273053997',
            waba_id: '2911168089062645',
            business_id: '199917389114645',
        },
    })
    @ValidateNested()
    @Type(() => DataObjectDto)
    data: DataObjectDto;
}
