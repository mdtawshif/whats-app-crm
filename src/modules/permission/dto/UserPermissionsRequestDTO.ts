import { ApiProperty } from '@nestjs/swagger';
import { AssetDTO } from '../../../utils/AssetDTO';
import { PermissionDTO } from '../../../utils/PermissionDTO';
import { User } from './User';
import { Asset } from './Asset';
import { Permission } from './Permission';

export class UserPermissionsRequestDTO {
    @ApiProperty({ type: () => User })
    public user: User;

    @ApiProperty({ type: () => Asset })
    public asset: Asset;

    @ApiProperty({ type: () => Permission, isArray: true })
    public permissions: Permission[];
}

