import { UseGuards } from '@nestjs/common';
import { RoleGuard } from '@/common/guard/role-guard';
import { RequiredRole } from '@/common/decorator/require-role.decorator';
import { RoleDTO } from '@/utils/RoleDTO';

/**
 * A custom decorator that combines `RoleGuard` and `RequiredRole` to restrict access to specific roles.
 *
 * @param roles - One or more `RoleDTO` instances representing the roles allowed to access the endpoint.
 * @returns A decorator that applies `RoleGuard` and sets the required roles metadata.
 *
 * @example
 * // Single role
 * ```ts
 * @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
 * @Get('events')
 * getEvents() { ... }
 * ```
 *
 * // Multiple roles
 * ```ts
 * @RestrictToRoles(
 *   RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME),
 *   RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME)
 * )
 * @Get('actions')
 * getActions() { ... }
 * ```
 */
export const RestrictToRoles = (...roles: RoleDTO[]) => {
    return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): void => {
        // Apply RoleGuard
        UseGuards(RoleGuard)(target, propertyKey, descriptor);

        // Apply RequiredRole with the role array
        RequiredRole(...roles)(target, propertyKey, descriptor);
    };
};
