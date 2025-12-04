import { Injectable } from '@nestjs/common';
import { PermissionUtil } from '../../utils/permission-util';
import { User } from './dto/User';
import { Asset } from './dto/Asset';
import { Permission } from './dto/Permission';
import { Role } from './dto/Role';
import { toLoginUser, toAssetDTO, toPermissionDTO, toRoleDTO, toPermissionDTOs, toUser, toRole } from '../../utils/dto-mapper';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { RoleDTO } from '@/utils/RoleDTO';
import { LoginUser } from '../auth/dto/login-user.dto';
import { applyMatrixToUser, UpdateUserPermissionBodyDto } from './helper/permission-helper';

@Injectable()
export class PermissionService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PermissionService.name);
  }

  async getUserPermission(
    userId: number
  ): Promise<User> {
    let user = new User();
    user.id = userId;
    let loginUser = toLoginUser(user);
    const userData = await this.prisma.user.findFirst({
      where: {
        id: loginUser.id
      },
      select: {
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
        email: true,
        userName: true,
        role: {
          select: { name: true, id: true }, // <-- relation selected here
        },
      },
    });
    loginUser.rolePermissionMask = BigInt(userData.rolePermissionMask);
    loginUser.addedPermissionMask = BigInt(userData.addedPermissionMask);
    loginUser.removedPermissionMask = BigInt(userData.removedPermissionMask);
    loginUser.roleId = userData.role.id;
    loginUser.roleName = userData.role.name;
    user = toUser(loginUser);
    user.permissions = await PermissionUtil.getPermissions(loginUser);
    user.roleName = loginUser.roleName;
    user.userName = loginUser.userName;

    return user;
  }

  async updateUserPermission(dto: UpdateUserPermissionBodyDto): Promise<User> {

    let userData = await this.prisma.user.findFirst({
      where: {
        id: dto.id
      },
      select: {
        id: true,
        email: true,
        agencyId: true,
        status: true,
        isMailVerified: true,
        userName: true,
        parentUserId: true,
        profileUrl: true,
        apiKey: true,
        createdAt: true,
        agency: { select: { name: true } },
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
      },
    });

    const loginUser: LoginUser = {
      ...userData,
      currentCredit: 0, // convert Decimal -> number
      access: null,
      refresh: null,
      packageId: null, // safe null check
      roleId: null,
      roleName: null,
      permissions: [], // 👈 required by LoginUser, initialize properly
      rolePermissionMask: BigInt(userData.rolePermissionMask),
      addedPermissionMask: BigInt(userData.addedPermissionMask),
      removedPermissionMask: BigInt(userData.removedPermissionMask)
    };

    const updatedUser = await applyMatrixToUser(loginUser, dto.matrix);

    console.log(updatedUser);

    let user = new User();
    user = toUser(loginUser);
    await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        rolePermissionMask: loginUser.rolePermissionMask.toString(),
        addedPermissionMask: loginUser.addedPermissionMask.toString(),
        removedPermissionMask: loginUser.removedPermissionMask.toString(),
      }
    });
    user.permissions = await PermissionUtil.getPermissions(loginUser);
    user.roleName = loginUser.roleName;
    user.userName = loginUser.userName;
    return user;
  }

  /**
   * Add a single permission to a user
   */
  async addUserPermission(
    user: User,
    asset: Asset,
    permission: Permission
  ): Promise<User> {
    let loginUser = toLoginUser(user);
    const userData = await this.prisma.user.findFirst({
      where: {
        id: loginUser.id
      },
      select: {
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
      },
    });
    loginUser.rolePermissionMask = BigInt(userData.rolePermissionMask);
    loginUser.addedPermissionMask = BigInt(userData.addedPermissionMask);
    loginUser.removedPermissionMask = BigInt(userData.removedPermissionMask);
    loginUser = await PermissionUtil.addUserPermission(loginUser, toAssetDTO(asset), toPermissionDTO(permission));
    user = toUser(loginUser);
    await this.prisma.user.update({
      where: {
        id: loginUser.id
      },
      data: {
        rolePermissionMask: loginUser.rolePermissionMask.toString(),
        addedPermissionMask: loginUser.addedPermissionMask.toString(),
        removedPermissionMask: loginUser.removedPermissionMask.toString(),
      }
    });
    user.permissions = await PermissionUtil.getPermissions(loginUser);
    return user;
  }

  /**
   * Add multiple permissions to a user at once
   */
  async addUserPermissions(
    user: User,
    asset: Asset,
    permissions: Permission[]
  ): Promise<User> {
    let loginUser = toLoginUser(user);
    const userData = await this.prisma.user.findFirst({
      where: {
        id: loginUser.id
      },
      select: {
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
      },
    });
    loginUser.rolePermissionMask = BigInt(userData.rolePermissionMask);
    loginUser.addedPermissionMask = BigInt(userData.addedPermissionMask);
    loginUser.removedPermissionMask = BigInt(userData.removedPermissionMask);
    loginUser = await PermissionUtil.addUserPermissions(loginUser, toAssetDTO(asset), toPermissionDTOs(permissions));
    user = toUser(loginUser);
    await this.prisma.user.update({
      where: {
        id: loginUser.id
      },
      data: {
        rolePermissionMask: loginUser.rolePermissionMask.toString(),
        addedPermissionMask: loginUser.addedPermissionMask.toString(),
        removedPermissionMask: loginUser.removedPermissionMask.toString(),
      }
    });
    user.permissions = await PermissionUtil.getPermissions(loginUser);
    return user;
  }

  /**
   * Remove a single permission from a user
   */
  async removeUserPermission(
    user: User,
    asset: Asset,
    permission: Permission
  ): Promise<User> {
    let loginUser = toLoginUser(user);
    const userData = await this.prisma.user.findFirst({
      where: {
        id: loginUser.id
      },
      select: {
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
      },
    });
    loginUser.rolePermissionMask = BigInt(userData.rolePermissionMask);
    loginUser.addedPermissionMask = BigInt(userData.addedPermissionMask);
    loginUser.removedPermissionMask = BigInt(userData.removedPermissionMask);
    loginUser = await PermissionUtil.removeUserPermission(loginUser, toAssetDTO(asset), toPermissionDTO(permission));
    user = toUser(loginUser);
    await this.prisma.user.update({
      where: {
        id: loginUser.id
      },
      data: {
        rolePermissionMask: loginUser.rolePermissionMask.toString(),
        addedPermissionMask: loginUser.addedPermissionMask.toString(),
        removedPermissionMask: loginUser.removedPermissionMask.toString(),
      }
    });
    user.permissions = await PermissionUtil.getPermissions(loginUser);
    return user;
  }

  /**
   * Remove multiple permissions from a user
   */
  async removeUserPermissions(
    user: User,
    asset: Asset,
    permissions: Permission[]
  ): Promise<User> {
    let loginUser = toLoginUser(user);
    const userData = await this.prisma.user.findFirst({
      where: {
        id: loginUser.id
      },
      select: {
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
      },
    });
    loginUser.rolePermissionMask = BigInt(userData.rolePermissionMask);
    loginUser.addedPermissionMask = BigInt(userData.addedPermissionMask);
    loginUser.removedPermissionMask = BigInt(userData.removedPermissionMask);
    loginUser = await PermissionUtil.removeUserPermissions(loginUser, toAssetDTO(asset), toPermissionDTOs(permissions));
    user = toUser(loginUser);
    await this.prisma.user.update({
      where: {
        id: loginUser.id
      },
      data: {
        rolePermissionMask: loginUser.rolePermissionMask.toString(),
        addedPermissionMask: loginUser.addedPermissionMask.toString(),
        removedPermissionMask: loginUser.removedPermissionMask.toString(),
      }
    });
    user.permissions = await PermissionUtil.getPermissions(loginUser);
    return user;
  }

  /**
   * Check if a user has a specific permission for an asset
   */
  async hasUserPermission(
    user: User,
    asset: Asset,
    permission: Permission
  ): Promise<boolean> {
    let loginUser = toLoginUser(user);
    const userData = await this.prisma.user.findFirst({
      where: {
        id: loginUser.id
      },
      select: {
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
      },
    });
    loginUser.rolePermissionMask = BigInt(userData.rolePermissionMask);
    loginUser.addedPermissionMask = BigInt(userData.addedPermissionMask);
    loginUser.removedPermissionMask = BigInt(userData.removedPermissionMask);
    return PermissionUtil.hasUserPermission(loginUser, toAssetDTO(asset), toPermissionDTO(permission));
  }

  // ===== Role Permission Methods =====

  async getRolePermission(
    roleId: number
  ): Promise<Role> {
    let role = new Role();
    role.id = roleId;
    let roleDTO = toRoleDTO(role);
    const roleData = await this.prisma.role.findFirst({
      where: {
        id: roleDTO.getId()
      },
      select: {
        permissionMask: true,
        name: true
      },
    });
    roleDTO = RoleDTO.of(roleDTO.getId(), roleData.name, BigInt(roleData.permissionMask));
    role = toRole(roleDTO);
    role.name = roleData.name;
    role.permissions = await PermissionUtil.getRolePermissions(roleDTO);
    return role;
  }

  /**
   * Add a single permission to a role
   */
  async addRolePermission(
    role: Role,
    asset: Asset,
    permission: Permission
  ): Promise<Role> {
    let roleDTO = toRoleDTO(role);
    const roleData = await this.prisma.role.findFirst({
      where: {
        id: roleDTO.getId()
      },
      select: {
        permissionMask: true,
        name: true
      },
    });
    roleDTO = RoleDTO.of(roleDTO.getId(), roleData.name, BigInt(roleData.permissionMask));
    roleDTO = await PermissionUtil.addRolePermission(roleDTO, toAssetDTO(asset), toPermissionDTO(permission));
    role = toRole(roleDTO);
    role.name = roleData.name;
    await this.prisma.role.update({
      where: {
        id: roleDTO.getId()
      },
      data: {
        permissionMask: roleDTO.getPermissionMask().toString()
      }
    });
    role.permissions = await PermissionUtil.getRolePermissions(roleDTO);
    return role;
  }

  /**
   * Add multiple permissions to a role
   */
  async addRolePermissions(
    role: Role,
    asset: Asset,
    permissions: Permission[]
  ): Promise<Role> {
    let roleDTO = toRoleDTO(role);
    const roleData = await this.prisma.role.findFirst({
      where: {
        id: roleDTO.getId()
      },
      select: {
        permissionMask: true,
        name: true
      },
    });
    roleDTO = RoleDTO.of(roleDTO.getId(), roleData.name, BigInt(roleData.permissionMask));
    roleDTO = await PermissionUtil.addRolePermissions(toRoleDTO(role), toAssetDTO(asset), toPermissionDTOs(permissions));
    role = toRole(roleDTO);
    role.name = roleData.name;
    await this.prisma.role.update({
      where: {
        id: roleDTO.getId()
      },
      data: {
        permissionMask: roleDTO.getPermissionMask().toString()
      }
    });
    role.permissions = await PermissionUtil.getRolePermissions(roleDTO);
    return role;
  }

  /**
   * Remove a single permission from a role
   */
  async removeRolePermission(
    role: Role,
    asset: Asset,
    permission: Permission
  ): Promise<Role> {
    let roleDTO = toRoleDTO(role);
    const roleData = await this.prisma.role.findFirst({
      where: {
        id: roleDTO.getId()
      },
      select: {
        permissionMask: true,
        name: true
      },
    });
    roleDTO = RoleDTO.of(roleDTO.getId(), roleData.name, BigInt(roleData.permissionMask));
    roleDTO = await PermissionUtil.removeRolePermission(roleDTO, toAssetDTO(asset), toPermissionDTO(permission));
    role = toRole(roleDTO);
    role.name = roleData.name;
    await this.prisma.role.update({
      where: {
        id: roleDTO.getId()
      },
      data: {
        permissionMask: roleDTO.getPermissionMask().toString()
      }
    });
    role.permissions = await PermissionUtil.getRolePermissions(roleDTO);
    return role;
  }

  /**
   * Remove multiple permissions from a role
   */
  async removeRolePermissions(
    role: Role,
    asset: Asset,
    permissions: Permission[]
  ): Promise<Role> {
    let roleDTO = toRoleDTO(role);
    const roleData = await this.prisma.role.findFirst({
      where: {
        id: roleDTO.getId()
      },
      select: {
        permissionMask: true,
        name: true
      },
    });
    roleDTO = RoleDTO.of(roleDTO.getId(), roleData.name, BigInt(roleData.permissionMask));
    roleDTO = await PermissionUtil.removeRolePermissions(roleDTO, toAssetDTO(asset), toPermissionDTOs(permissions));
    role = toRole(roleDTO);
    role.name = roleData.name;
    await this.prisma.role.update({
      where: {
        id: roleDTO.getId()
      },
      data: {
        permissionMask: roleDTO.getPermissionMask().toString()
      }
    });
    role.permissions = await PermissionUtil.getRolePermissions(roleDTO);
    return role;
  }

  /**
   * Check if a role has a specific permission for an asset
   */
  async hasRolePermission(
    role: Role,
    asset: Asset,
    permission: Permission
  ): Promise<boolean> {
    let roleDTO = toRoleDTO(role);
    const roleData = await this.prisma.role.findFirst({
      where: {
        id: roleDTO.getId()
      },
      select: {
        permissionMask: true,
        name: true
      },
    });
    roleDTO = RoleDTO.of(roleDTO.getId(), roleData.name, BigInt(roleData.permissionMask));
    return PermissionUtil.hasRolePermission(roleDTO, toAssetDTO(asset), toPermissionDTO(permission));
  }


}
