import { ApiProperty } from '@nestjs/swagger';
import { Asset } from './Asset';
import { Permission } from './Permission';
import { Role } from './Role';

export class RolePermissionRequestDTO {
    @ApiProperty({ type: () => Role })
    public role: Role;

    @ApiProperty({ type: () => Asset })
    public asset: Asset;

    @ApiProperty({ type: () => Permission })
    public permission: Permission;
}

