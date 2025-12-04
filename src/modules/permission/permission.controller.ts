import { Controller, Post, Body, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBody, ApiResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { UserPermissionRequestDTO } from './dto/UserPermissionRequestDTO';
import { UserPermissionsRequestDTO } from './dto/UserPermissionsRequestDTO';
import { User } from './dto/User';
import { Role } from './dto/Role';
import { RolePermissionRequestDTO } from './dto/RolePermissionRequestDTO';
import { RolePermissionsRequestDTO } from './dto/RolePermissionsRequestDTO';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RoleGuard } from '../../common/guard/role-guard';
import { RoleDTO } from '../../utils/RoleDTO';
import { RequiredRole } from '../../common/decorator/require-role.decorator';
import { UpdateUserPermissionBodyDto } from './helper/permission-helper';
import { LoginUser } from '../auth/dto/login-user.dto';

@ApiTags('Permission')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) { }

  // ===== User Permissions Endpoints =====

  /**
 * Get permissions for a specific user
 */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('user/:id')
  @ApiResponse({
    status: 200,
    description: 'User permissions retrieved successfully',
    type: User,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid user id provided',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserPermission(
    @Param('id') id: number,
  ): Promise<User> {
    return this.permissionService.getUserPermission(id);
  }


  /** Add a single permission to a user */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('user/add')
  async addUserPermission(
    @Body() body: UserPermissionRequestDTO,
  ): Promise<User> {
    const user = this.permissionService.addUserPermission(body.user, body.asset, body.permission);
    console.log(user);
    return user;
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('user/update')
  async updateUserPermission(@Request() req: { user: LoginUser },
    @Body() dto: UpdateUserPermissionBodyDto
  ): Promise<User> {
    const user = this.permissionService.updateUserPermission(dto);
    console.log(user);
    return user;
  }

  /** Add multiple permissions to a user */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('user/add-multiple')
  @ApiBody({ type: UserPermissionsRequestDTO, description: 'Details of the user, asset, and multiple permissions to add' })
  @ApiResponse({ status: 201, description: 'Multiple permissions successfully added to the user', type: User })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async addUserPermissions(
    @Body() body: UserPermissionsRequestDTO,
  ): Promise<User> {
    return this.permissionService.addUserPermissions(
      body.user,
      body.asset,
      body.permissions,
    );
  }

  /** Remove a single permission from a user */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('user/remove')
  @ApiBody({ type: UserPermissionRequestDTO, description: 'Details of the user, asset, and permission to remove' })
  @ApiResponse({ status: 200, description: 'Permission successfully removed from the user', type: User })
  @ApiResponse({ status: 400, description: 'Invalid input data or permission not found' })
  async removeUserPermission(
    @Body() body: UserPermissionRequestDTO,
  ): Promise<User> {
    return this.permissionService.removeUserPermission(
      body.user,
      body.asset,
      body.permission,
    );
  }

  /** Remove multiple permissions from a user */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('user/remove-multiple')
  @ApiBody({ type: UserPermissionsRequestDTO, description: 'Details of the user, asset, and multiple permissions to remove' })
  @ApiResponse({ status: 200, description: 'Multiple permissions successfully removed from the user', type: User })
  @ApiResponse({ status: 400, description: 'Invalid input data or permissions not found' })
  async removeUserPermissions(
    @Body() body: UserPermissionsRequestDTO,
  ): Promise<User> {
    return this.permissionService.removeUserPermissions(
      body.user,
      body.asset,
      body.permissions,
    );
  }

  /** Check if a user has a specific permission */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('user/has')
  @ApiBody({ type: UserPermissionRequestDTO, description: 'Details of the user, asset, and permission to check' })
  @ApiResponse({ status: 200, description: 'Successfully checked if the user has the specified permission', type: Boolean })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async hasUserPermission(
    @Body() body: UserPermissionRequestDTO,
  ): Promise<boolean> {
    return this.permissionService.hasUserPermission(
      body.user,
      body.asset,
      body.permission,
    );
  }

  // ===== Role Permissions Endpoints =====

  /** Get role permissions */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('role/:id')
  @ApiResponse({
    status: 200,
    description: 'Role permissions fetched successfully',
    type: Role,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role id format',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async getRolePermission(
    @Param('id') id: number,
  ): Promise<Role> {
    return this.permissionService.getRolePermission(id);
  }

  /** Add a single permission to a role */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('role/add')
  @ApiBody({ type: RolePermissionRequestDTO, description: 'Details of the role, asset, and permission to add' })
  @ApiResponse({ status: 201, description: 'Permission successfully added to the role', type: Role })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async addRolePermission(
    @Body() body: RolePermissionRequestDTO,
  ): Promise<Role> {
    return this.permissionService.addRolePermission(
      body.role,
      body.asset,
      body.permission,
    );
  }

  /** Add multiple permissions to a role */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('role/add-multiple')
  @ApiBody({ type: RolePermissionsRequestDTO, description: 'Details of the role, asset, and multiple permissions to add' })
  @ApiResponse({ status: 201, description: 'Multiple permissions successfully added to the role', type: Role })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async addRolePermissions(
    @Body() body: RolePermissionsRequestDTO,
  ): Promise<Role> {
    return this.permissionService.addRolePermissions(
      body.role,
      body.asset,
      body.permissions,
    );
  }

  /** Remove a single permission from a role */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('role/remove')
  @ApiBody({ type: RolePermissionRequestDTO, description: 'Details of the role, asset, and permission to remove' })
  @ApiResponse({ status: 200, description: 'Permission successfully removed from the role', type: Role })
  @ApiResponse({ status: 400, description: 'Invalid input data or permission not found' })
  async removeRolePermission(
    @Body() body: RolePermissionRequestDTO,
  ): Promise<Role> {
    return this.permissionService.removeRolePermission(
      body.role,
      body.asset,
      body.permission,
    );
  }

  /** Remove multiple permissions from a role */
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post('role/remove-multiple')
  @ApiBody({ type: RolePermissionsRequestDTO, description: 'Details of the role, asset, and multiple permissions to remove' })
  @ApiResponse({ status: 200, description: 'Multiple permissions successfully removed from the role', type: Role })
  @ApiResponse({ status: 400, description: 'Invalid input data or permissions not found' })
  async removeRolePermissions(
    @Body() body: RolePermissionsRequestDTO,
  ): Promise<Role> {
    return this.permissionService.removeRolePermissions(
      body.role,
      body.asset,
      body.permissions,
    );
  }

  /** Check if a role has a specific permission */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('role/has')
  @ApiBody({ type: RolePermissionRequestDTO, description: 'Details of the role, asset, and permission to check' })
  @ApiResponse({ status: 200, description: 'Successfully checked if the role has the specified permission', type: Boolean })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async hasRolePermission(
    @Body() body: RolePermissionRequestDTO,
  ): Promise<boolean> {
    return this.permissionService.hasRolePermission(
      body.role,
      body.asset,
      body.permission,
    );
  }

}