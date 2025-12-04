import { IsString, IsOptional } from 'class-validator';

export class DownloadFileDto {
    @IsString()
    @IsOptional()
    url?: string;

    @IsString()
    @IsOptional()
    key?: string;

    @IsString()
    @IsOptional()
    bucket?: string;
}