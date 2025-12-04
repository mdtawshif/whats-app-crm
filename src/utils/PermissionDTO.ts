import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString } from 'class-validator';
// utils/PermissionDTO.ts
export class PermissionDTO {

    //  Unique identifier of the permission (optional for creation)
    @ApiProperty({
        description: 'Unique identifier of the permission',
        type: Number,
        required: false,
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    private readonly id: bigint;

    //  Name of the permission (e.g., Create, Edit)
    @ApiProperty({
        description: 'Name of the permission',
        type: String,
        example: 'Create',
    })
    @IsString()
    private readonly name: string;

    private constructor(id: bigint, name: string) {
        this.id = id;
        this.name = name;
    }

    //  1. Factory with name only
    public static ofName(name: string): PermissionDTO {
        return new PermissionDTO(0n, name);
    }

    //  2. Factory with id + name
    public static ofIdAndName(id: bigint, name: string): PermissionDTO {
        return new PermissionDTO(id, name);
    }

    //  3. Factory with id + name (alias for clarity)
    public static of(id: bigint, name: string): PermissionDTO {
        return new PermissionDTO(id, name);
    }


    public getId(): bigint {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public toString(): string {
        return `Permission{id=${this.id}, name='${this.name}'}`;
    }

    // Helper method for power-of-2 validation
    private static isBitwiseValue(value: bigint): boolean {
        return value > 0n && (value & (value - 1n)) === 0n;
    }

    public static CREATE_PERMISSION_NAME = 'Create';
    public static EDIT_PERMISSION_NAME = 'Edit';
    public static VIEW_PERMISSION_NAME = 'View';
    public static DELETE_PERMISSION_NAME = 'Delete';
    public static EXPORT_PERMISSION_NAME = 'Export';

    public static CREATE_PERMISSION_VALUE: bigint = 2n;
    public static EDIT_PERMISSION_VALUE: bigint = 4n
    public static VIEW_PERMISSION_VALUE: bigint = 8n;
    public static DELETE_PERMISSION_VALUE: bigint = 16n;
    public static EXPORT_PERMISSION_VALUE: bigint = 32n;
}
