import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString } from 'class-validator';
export class RoleDTO {

  //  Unique identifier of the role (optional for creation)
  @ApiProperty({
    description: 'Unique identifier of the role',
    type: Number,
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  private readonly id: bigint;

  //  Name of the role (e.g., Admin, Member)
  @ApiProperty({
    description: 'Name of the role',
    type: String,
    example: 'Admin',
  })
  @IsString()
  private readonly name: string;

  //  Permission mask (bitwise value representing assigned permissions)
  @ApiProperty({
    description: 'Bitwise mask representing the permissions assigned to this role',
    type: Number,
    example: 30,
  })
  @IsNumber()
  private readonly permissionMask: bigint;

  private constructor(id: bigint, name: string, permissionMask: bigint) {
    this.id = id;
    this.name = name;
    this.permissionMask = permissionMask;
  }

  //  0. Factory with name only (default id & permissionMask)
  public static ofId(id: bigint): RoleDTO {
    return new RoleDTO(id, '', 0n);
  }

  //  1. Factory with name only (default id & permissionMask)
  public static ofName(name: string): RoleDTO {
    return new RoleDTO(0n, name, 0n);
  }

  //  2. Factory with id + name (default permissionMask)
  public static ofIdAndName(id: bigint, name: string): RoleDTO {
    return new RoleDTO(id, name, 0n);
  }

  //  3. Factory with id + name + permissionMask
  public static of(id: bigint, name: string, permissionMask: bigint): RoleDTO {
    return new RoleDTO(id, name, permissionMask);
  }

  public getId(): bigint {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getPermissionMask(): bigint {
    return this.permissionMask;
  }

  public toString(): string {
    return `Role{id=${this.id}, name='${this.name}', permissionMask=${this.permissionMask}}`;
  }

  public static SUPER_ADMIN_ROLE_NAME = "Super Admin";
  public static ADMIN_ROLE_NAME = "Admin";
  public static TEAM_LEADER_ROLE_NAME = "Team Leader";
  public static MEMBER_ROLE_NAME = "Member";


}
