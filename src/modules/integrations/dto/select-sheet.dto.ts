// dto/select-sheet.dto.ts
import { IsString } from 'class-validator';

export class SelectSheetDto {
    @IsString()
    spreadsheetId: string;
}