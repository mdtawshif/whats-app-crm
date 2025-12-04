import { SetMetadata } from '@nestjs/common';
import { AssetDTO } from '../../utils/AssetDTO';
import { PermissionDTO } from '../../utils/PermissionDTO';
import { PERMISSION_METADATA_KEY } from '../guard/permission-guard';

export const RequirePermission = (asset: AssetDTO, permission: PermissionDTO) =>
  SetMetadata(PERMISSION_METADATA_KEY, { asset, permission });
