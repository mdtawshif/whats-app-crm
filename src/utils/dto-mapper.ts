// src/utils/dto-mapper.ts

import { LoginUser } from '../modules/auth/dto/login-user.dto';
import { RoleDTO } from "../utils/RoleDTO";
import { Role } from "../modules/permission/dto/Role";
import { PermissionDTO } from '../utils/PermissionDTO';
import { AssetDTO } from '../utils/AssetDTO';
import { Asset } from "../modules/permission/dto/Asset";
import { Permission } from "../modules/permission/dto/Permission";
import { User } from '../modules/permission/dto/User';

// Convert User -> LoginUser
export function toLoginUser(user: User): LoginUser {
  const loginUser = new LoginUser();
  loginUser.id = BigInt(user.id);

  // Initialize other fields as null/default
  loginUser.access = null;
  loginUser.refresh = null;
  loginUser.email = '';
  loginUser.profileUrl = null;
  loginUser.apiKey = null;
  loginUser.parentUserId = null;
  loginUser.packageId = null;
  loginUser.agencyId = null;
  loginUser.currentCredit = 0;
  loginUser.userName = null;
  loginUser.roleId = null;
  loginUser.roleName = null;
  loginUser.permissions = [];
  loginUser.isMailVerified = 'false';
  loginUser.status = null as any;

  return loginUser;
}

// Convert Role -> RoleDTO
export function toRoleDTO(role: Role): RoleDTO {
  return RoleDTO.ofId(BigInt(role.id));
  // or if you have id field in Role: RoleDTO.of(role.id, role.name, role.rolePermissionMask)
}

// Convert Permission -> PermissionDTO
export function toPermissionDTO(permission: Permission): PermissionDTO {
  return PermissionDTO.ofName(permission.name);
}

// Convert Asset -> AssetDTO
export function toAssetDTO(asset: Asset): AssetDTO {
  return AssetDTO.ofName(asset.name);
}

/**
 * Convert an array of Permission to an array of PermissionDTO
 */
export function toPermissionDTOs(permissions: Permission[]): PermissionDTO[] {
  return permissions.map((perm) => toPermissionDTO(perm));
}


/**
 * Convert LoginUser → User
 */
export function toUser(loginUser: LoginUser): User {
  const user = new User();
  user.id = Number(loginUser.id);
  return user;
}

/**
 * Convert RoleDTO → Role
 */
export function toRole(roleDTO: RoleDTO): Role {
  const role = new Role();
  role.id = Number(roleDTO.getId());
  return role;
}

/**
 * Convert PermissionDTO → Permission
 */
export function toPermission(permissionDTO: PermissionDTO): Permission {
  const permission = new Permission();
  permission.name = permissionDTO.getName();
  return permission;
}

/**
 * Convert AssetDTO → Asset
 */
export function toAsset(assetDTO: AssetDTO): Asset {
  const asset = new Asset();
  asset.name = assetDTO.getName();
  return asset;
}

/**
 * Convert an array of PermissionDTO → Permission
 */
export function toPermissions(permissionDTOs: PermissionDTO[]): Permission[] {
  return permissionDTOs.map((dto) => toPermission(dto));
}
