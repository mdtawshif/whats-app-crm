import { SetMetadata } from '@nestjs/common';
import { RoleDTO } from '../../utils/RoleDTO';

export const REQUIRED_ROLE_KEY = 'required_role';

export const RequiredRole = (...roles: RoleDTO[]) => {
  const roleNames = roles.map(role => role.getName()); // Extract role names
  return SetMetadata(REQUIRED_ROLE_KEY, roleNames);
};
