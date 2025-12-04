import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
export class Role {

    @ApiProperty({ type: Number, example: 1 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)   // 👈 converts "1" -> 1
    id: number;

    //  Name of the role (e.g., Admin, Member)
    @ApiProperty({
        description: 'Name of the role',
        type: String,
        example: 'Admin',
    })
    @IsString()
    @IsOptional()
    name?: string;

    permissions: Record<string, Record<string, boolean>> | [];

}