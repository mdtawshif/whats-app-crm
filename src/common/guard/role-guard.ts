import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoginUser } from '../../modules/auth/dto/login-user.dto';
import { REQUIRED_ROLE_KEY } from '../decorator/require-role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true; // no roles required

    const request = context.switchToHttp().getRequest();
    const user: LoginUser = request.user;

    if (!requiredRoles.includes(user.roleName)) {
      throw new ForbiddenException({
        message: 'You are not authorized to access this resource.',
        responseCode: 4031,
        success: false,
      });
    }

    return true;
  }
}
