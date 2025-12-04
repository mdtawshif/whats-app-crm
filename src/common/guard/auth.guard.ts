import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserPackageStatus, UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from 'nestjs-prisma';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { RedisService } from 'src/modules/redis/redis.service';
import { PermissionUtil } from '../../utils/permission-util';
import { Logger } from 'nestjs-pino';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private redisService: RedisService,
    private logger: Logger,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException();
    }

    let loggedInUser: LoginUser | null = null;

    try {
      await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: false,
      });

      loggedInUser = await this.validateUser(token);

      if (!loggedInUser) {
        this.logger.warn('No user found for token', { token });
        throw new Error('Forbidden');
      }

      loggedInUser.permissions = await PermissionUtil.getPermissions(loggedInUser);

      request['user'] = loggedInUser;
    } catch (error) {
      this.logger.error('AuthGuard error', { error });

      const errorObj = {
        message: 'Forbidden',
        responseCode: 4001,
        success: false,
      };

      if (error.message === 'jwt expired') {
        errorObj.message = 'Session expired';
        errorObj.responseCode = 4003;
      } else if (error.message === 'invalid signature') {
        errorObj.responseCode = 4002;
      } else if (error.name === 'PrismaClientUnknownRequestError') {
        errorObj.message = 'Database connection error';
        errorObj.responseCode = 4004;
      }

      throw new HttpException(errorObj, 403);
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  async validateUser(token: string): Promise<LoginUser | null> {

    const tokenDoc = await this.prisma.token.findFirst({
      where: {
        token,
        type: 'ACCESS',
        blacklisted: false,
      },
      select: {
        userId: true,
        expires: true,
      },
    });

    // console.log('tokenDoc', tokenDoc);

    if (!tokenDoc) return null;

    const userData = await this.prisma.user.findFirst({
      where: {
        id: tokenDoc.userId,
        status: { in: [UserStatus.ACTIVE, UserStatus.PENDING, UserStatus.NEED_TO_RESET_CREDENTIAL] }
      },
      select: {
        id: true,
        email: true,
        status: true,
        profileUrl: true,
        parentUserId: true,
        agencyId: true,
        currentCredit: true,
        userName: true,
        roleId: true,
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
        apiKey: true,
        isMailVerified: true,
        createdAt: true,
        timeZone: true,
        agency: {
          select: {
            id: true,
            name: true,
            status: true

          },
        },
      },
    })

    // console.log('userData', userData);

    if (!userData) {
      return null;
    }

    let roleName: string | null = null;

    const userPackageData = await this.prisma.userPackage.findFirst({
      where: {
        userId: userData.id,
        status: { in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING] },
      },
      select: {
        id: true
      }
    });

    if (!userData.parentUserId) {
      userData.parentUserId = userData.id
    }

    if (userData.roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          id: userData.roleId,
        },
        select: {
          name: true,
        },
      });
      if (role) {
        roleName = role.name;
      }
    }

    const loginUser: LoginUser = {
      ...userData,
      currentCredit: userData.currentCredit.toNumber(),
      access: null,
      refresh: null,
      packageId: userPackageData?.id ?? null,
      roleName,
      permissions: [],
      isMailVerified: userData.isMailVerified,
      rolePermissionMask: BigInt(userData.rolePermissionMask),
      addedPermissionMask: BigInt(userData.addedPermissionMask),
      removedPermissionMask: BigInt(userData.removedPermissionMask),
    };

    return loginUser;

  }
}