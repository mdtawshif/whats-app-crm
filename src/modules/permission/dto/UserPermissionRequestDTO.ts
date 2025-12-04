import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
import { User } from './User';
import { Permission } from './Permission';
import { Asset } from './Asset';

export class UserPermissionRequestDTO {

  @ApiProperty({
    type: () => User,
    description: 'The user to whom the permission is granted',
  })
  @Type(() => User)
  @IsNotEmpty()
  user: User;

  @ApiProperty({
    type: () => Permission,
    description: 'Permission that given against asset to the user',
  })
  @Type(() => Permission)
  @IsNotEmpty()
  permission: Permission;

  @ApiProperty({
    type: () => Asset,
    description: 'Permission that given against asset to the user',
  })
  @Type(() => Asset)
  @IsNotEmpty()
  asset: Asset;


}