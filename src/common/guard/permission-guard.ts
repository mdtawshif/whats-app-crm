import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { AssetDTO } from '../../utils/AssetDTO';
import { PermissionDTO } from '../../utils/PermissionDTO';
import { PermissionUtil } from '../../utils/permission-util';

export const PERMISSION_METADATA_KEY = 'requiredPermission';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<{ asset: AssetDTO; permission: PermissionDTO }>(
      PERMISSION_METADATA_KEY,
      context.getHandler()
    );

    if (!required) {
      return true; // No specific permission required
    }

    const request = context.switchToHttp().getRequest();
    const user: LoginUser = request.user;

    if (!user) {
      throw new ForbiddenException({
        message: 'User not authenticated',
        responseCode: 4030,
        success: false,
      });
    }

    const hasPermission = await PermissionUtil.hasUserPermission(
      user,
      required.asset,
      required.permission
    );

    console.log('hasPermission', hasPermission);
    console.log('required.asset', required.asset);
    console.log('required.permission', required.permission);

    if (!hasPermission) {
      throw new ForbiddenException({
        message: `You do not have permission to ${required.permission.getName()} ${required.asset.getName()}.`,
        responseCode: 4031,
        success: false,
      });
    }

    return true;
  }
}
