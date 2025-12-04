import { ApiProperty } from '@nestjs/swagger';


import { UserStatus } from '@prisma/client';
import { CustomIsNotEmpty, CustomIsEmail, CustomIsLowercase, CustomMinLength } from '../../../common/validators/field-validators';

export class LoginUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@orangetoolz.com',
  })
  @CustomIsNotEmpty()
  @CustomIsEmail()
  @CustomIsLowercase()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Test000@#',
  })
  @CustomIsNotEmpty()
  @CustomMinLength(6)
  password: string;
}

export class ForceLoginUserDto {
  @ApiProperty()
  @CustomIsNotEmpty()
  @CustomIsEmail()
  @CustomIsLowercase()
  email: string;
}

export class TokenDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  expires: Date;
}

export class UserToken {

  @ApiProperty()
  userId: bigint;

  @ApiProperty()
  access: TokenDto;

  @ApiProperty()
  refresh: TokenDto;

}

export class LoginUser {

  @ApiProperty()
  access: TokenDto | null;

  @ApiProperty()
  refresh: TokenDto | null;

  @ApiProperty()
  id: bigint;

  @ApiProperty()
  email: string;

  @ApiProperty()
  profileUrl: string | null;

  @ApiProperty()
  apiKey: string | null;

  @ApiProperty()
  parentUserId: bigint | null;

  @ApiProperty()
  packageId: bigint | null;

  @ApiProperty()
  agencyId: bigint | null;

  @ApiProperty()
  currentCredit: number;

  @ApiProperty()
  userName: string | null;

  @ApiProperty()
  timeZone: string | null;

  @ApiProperty()
  roleId: bigint | null;

  @ApiProperty()
  roleName: string | null;

  @ApiProperty()
  rolePermissionMask: bigint;

  @ApiProperty()
  addedPermissionMask: bigint;

  @ApiProperty()
  removedPermissionMask: bigint;

  @ApiProperty()
  permissions: Record<string, Record<string, boolean>> | [];

  @ApiProperty()
  isMailVerified: string;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  agency: {
    name: string;
  };

}