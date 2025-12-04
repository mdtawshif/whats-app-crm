import { LoginUser } from '../../auth/dto/login-user.dto';
import { AssetDTO } from '../../../utils/AssetDTO';
import { PermissionDTO } from '../../../utils/PermissionDTO';
import { PermissionUtil } from '../../../utils/permission-util';
import { PermissionRegistry } from '../../../utils/permission-registry';

export type PermissionMatrix = Record<string, Record<string, boolean>>;

import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserPermissionBodyDto {

  @ApiProperty({ type: Number, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  id: number;

  @ApiProperty({
    description: 'Permissions matrix: { [assetName]: { [permissionName]: boolean } }',
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
      description: 'Permission flags by permission name',
    },
    example: {
      Contacts: { Create: true, Edit: true, View: false, Delete: false, Export: false },
      'Message Templates': { Create: false, Edit: true, View: false, Delete: false, Export: false },
    },
  })
  @IsObject()
  matrix!: Record<string, Record<string, boolean>>;
}


export function grantedByAsset(matrix: PermissionMatrix): Array<{ asset: string; permissions: string[] }> {
  return Object.entries(matrix).map(([asset, perms]) => ({
    asset,
    permissions: Object.entries(perms)
      .filter(([, allowed]) => allowed)
      .map(([name]) => name),
  }));
}

export async function applyMatrixToUser(user: LoginUser, matrix: PermissionMatrix): Promise<LoginUser> {
  for (const [assetName, permMap] of Object.entries(matrix)) {
    const asset = AssetDTO.ofName(assetName);
    for (const [permName, allowed] of Object.entries(permMap)) {
      const perm = PermissionDTO.ofName(permName);
      if (allowed) {
        user = await PermissionUtil.addUserPermission(user, asset, perm);
      } else {
        user = await PermissionUtil.removeUserPermission(user, asset, perm);
      }
    }
  }
  return user;
}

export function validateMatrixKeys(matrix: PermissionMatrix): string[] {
  const errors: string[] = [];
  for (const [assetName, permMap] of Object.entries(matrix)) {
    for (const permName of Object.keys(permMap)) {
      const bit = PermissionRegistry.get(assetName, permName);
      if (!bit) errors.push(`Unknown permission: "${assetName}:${permName}"`);
    }
  }
  return errors;
}