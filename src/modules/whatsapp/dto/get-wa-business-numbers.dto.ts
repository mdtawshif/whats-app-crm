import { IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class GetWaBusinessNumbersDto {
    @IsOptional()
    @IsString()
    query?: string;

    @IsOptional()
    @Min(1)
    @IsPositive()
    limit?: number = 20;

    @IsOptional()
    @Min(1)
    @IsPositive()
    page?: number = 1;

    @IsOptional()
    @IsString()
    status?: string;
}