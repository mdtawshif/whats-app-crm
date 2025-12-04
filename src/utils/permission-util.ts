import { PermissionRegistry } from "../../src/utils/permission-registry";
import { AssetDTO } from "../../src/utils/AssetDTO";
import { PermissionDTO } from "../../src/utils/PermissionDTO";
import { LoginUser } from "src/modules/auth/dto/login-user.dto";
import { RoleDTO } from "../../src/utils/RoleDTO";
import { EncodePermissionDTO } from "../../src/utils/EncodePermissionDTO";
import { toRole } from "../../src/utils/dto-mapper";

export class PermissionUtil {


    /**
     * 
     * @param user 
     * @param asset 
     * @param permission 
     * @returns 
     */
    public static async addUserPermission(
        user: LoginUser,
        asset: AssetDTO,
        permission: PermissionDTO
    ): Promise<LoginUser> {

        const permBit = PermissionRegistry.get(asset.getName(), permission.getName());

        if (!permBit) {
            throw new Error(`Permission not found: ${asset.getName()}:${permission.getName()}`);
        }

        // Remove from removedMask if it was previously removed
        if ((user.removedPermissionMask & permBit) !== 0n) {
            user.removedPermissionMask = user.removedPermissionMask &= ~permBit;
        }

        // Add to addedMask
        user.addedPermissionMask = user.addedPermissionMask |= permBit;

        return user;
    }

    /**
     * 
     * @param user 
     * @param asset 
     * @param permissions 
     * @returns 
     */
    public static async addUserPermissions(
        user: LoginUser,
        asset: AssetDTO,
        permissions: PermissionDTO[]
    ): Promise<LoginUser> {

        for (const permission of permissions) {

            user = await PermissionUtil.addUserPermission(user, asset, permission);

        }

        return user;
    }


    /**
     * 
     * @param user 
     * @param asset 
     * @param permission 
     * @returns 
     */
    public static async removeUserPermission(
        user: LoginUser,
        asset: AssetDTO,
        permission: PermissionDTO
    ): Promise<LoginUser> {

        const permBit = PermissionRegistry.get(asset.getName(), permission.getName());

        if (!permBit) {
            throw new Error(`Permission not found: ${asset.getName()}:${permission.getName()}`);
        }

        // Remove from addedMask if it was previously added
        if ((user.addedPermissionMask & permBit) !== 0n) {
            user.addedPermissionMask = user.addedPermissionMask &= ~permBit;
        }

        // Add to removedMask
        user.removedPermissionMask = user.removedPermissionMask |= permBit;

        return user;
    }

    /**
     * 
     * @param user 
     * @param asset 
     * @param permissions 
     * @returns 
     */
    public static async removeUserPermissions(
        user: LoginUser,
        asset: AssetDTO,
        permissions: PermissionDTO[]
    ): Promise<LoginUser> {

        for (const permission of permissions) {

            user = await PermissionUtil.removeUserPermission(user, asset, permission);

        }

        return user;
    }

    /**
 * Compute effective mask = role + added - removed
 */
    private static async getEffectiveMask(loginUser: LoginUser): Promise<bigint> {
        return (loginUser.rolePermissionMask | loginUser.addedPermissionMask) & ~loginUser.removedPermissionMask;
    }

    public static async getPermissions(loginUser: LoginUser): Promise<Record<string, Record<string, boolean>>> {
        const effectiveMask = await this.getEffectiveMask(loginUser);
        loginUser.permissions = {};

        for (const [key, bit] of PermissionRegistry.all()) {
            const [assetName, permissionName] = key.split(":");

            if (!loginUser.permissions[assetName]) {
                loginUser.permissions[assetName] = {};
            }

            loginUser.permissions[assetName][permissionName] = (effectiveMask & bit) !== 0n;
        }
        return loginUser.permissions;

    }

    public static async getRolePermissions(roleDTO: RoleDTO): Promise<Record<string, Record<string, boolean>>> {
        let role = toRole(roleDTO);
        const effectiveMask = roleDTO.getPermissionMask();
        role.permissions = {};

        for (const [key, bit] of PermissionRegistry.all()) {
            const [assetName, permissionName] = key.split(":");
            if (!role.permissions[assetName]) {
                role.permissions[assetName] = {};
            }
            role.permissions[assetName][permissionName] = (effectiveMask & bit) !== 0n;
        }

        return role.permissions;

    }

    /**
     * 
     * @param user 
     * @param asset 
     * @param permission 
     * @returns 
     */
    public static async hasUserPermission(
        user: LoginUser,
        asset: AssetDTO,
        permission: PermissionDTO
    ): Promise<boolean> {

        // Get permission bit from registry
        const permBit = PermissionRegistry.get(asset.getName(), permission.getName());

        if (!permBit) {
            throw new Error(`Permission not found: ${asset.getName()}:${permission.getName()}`);
        }

        // Calculate effective mask
        const effectiveMask = (user.rolePermissionMask | user.addedPermissionMask) & ~user.removedPermissionMask;

        // Check if permission bit is set in effective mask
        return (effectiveMask & permBit) !== 0n;

    }

    /**
     * 
     * @param role 
     * @param asset 
     * @param permission 
     * @returns 
     */
    public static async addRolePermission(
        role: RoleDTO,
        asset: AssetDTO,
        permission: PermissionDTO
    ): Promise<RoleDTO> {

        const permBit = PermissionRegistry.get(asset.getName(), permission.getName());

        if (!permBit) {
            throw new Error(`Permission not found: ${asset.getName()}:${permission.getName()}`);
        }

        // Add permission to role's mask
        const newMask = role.getPermissionMask() | permBit;

        // Return a new RoleDTO with updated mask
        return RoleDTO.of(role.getId(), role.getName(), newMask);
    }

    /**
     * 
     * @param role 
     * @param asset 
     * @param permissions 
     * @returns 
     */
    public static async addRolePermissions(
        role: RoleDTO,
        asset: AssetDTO,
        permissions: PermissionDTO[]
    ): Promise<RoleDTO> {

        for (const permission of permissions) {
            role = await PermissionUtil.addRolePermission(role, asset, permission);
        }

        // Return a new RoleDTO with updated mask
        return role;
    }

    /**
     * 
     * @param role 
     * @param asset 
     * @param permission 
     * @returns 
     */
    public static async removeRolePermission(
        role: RoleDTO,
        asset: AssetDTO,
        permission: PermissionDTO
    ): Promise<RoleDTO> {

        const permBit = PermissionRegistry.get(asset.getName(), permission.getName());

        if (!permBit) {
            throw new Error(`Permission not found: ${asset.getName()}:${permission.getName()}`);
        }

        // Remove permission from role's mask
        const newMask = role.getPermissionMask() & ~permBit;

        // Return a new RoleDTO with updated mask
        return RoleDTO.of(role.getId(), role.getName(), newMask);
    }

    public static async removeRolePermissions(
        role: RoleDTO,
        asset: AssetDTO,
        permissions: PermissionDTO[]
    ): Promise<RoleDTO> {

        for (const permission of permissions) {

            role = await PermissionUtil.removeRolePermission(role, asset, permission);

        }

        // Return a new RoleDTO with updated mask
        return role;
    }

    /**
     * 
     * @param role 
     * @param asset 
     * @param permission 
     * @returns 
     */
    public static async hasRolePermission(
        role: RoleDTO,
        asset: AssetDTO,
        permission: PermissionDTO
    ): Promise<boolean> {

        const permBit = PermissionRegistry.get(asset.getName(), permission.getName());

        if (!permBit) {
            throw new Error(`Permission not found: ${asset.getName()}:${permission.getName()}`);
        }

        // Check if permission bit is set in role's mask
        return (role.getPermissionMask() & permBit) !== 0n;
    }

    /**
     * 
     * @param user 
     * @param encodePermissions 
     * @returns 
     */
    public static async encodeUserPermissions(
        user: LoginUser,
        encodePermissions: EncodePermissionDTO[]
    ): Promise<LoginUser> {

        for (const ep of encodePermissions) {

            const asset = ep.getAsset();
            const permissions = ep.getPermissions();

            for (const perm of permissions) {
                user = await PermissionUtil.addUserPermission(user, asset, perm);
            }

        }

        return user;
    }


    /**
     * 
     * @param role 
     * @param encodePermissions 
     * @returns 
     */
    public static async encodeRolePermissions(
        role: RoleDTO,
        encodePermissions: EncodePermissionDTO[]
    ): Promise<RoleDTO> {


        for (const ep of encodePermissions) {

            const asset = ep.getAsset();
            const permissions = ep.getPermissions();

            for (const perm of permissions) {
                role = await PermissionUtil.addRolePermission(role, asset, perm);
            }

        }

        // Return a new RoleDTO with updated mask
        return role;
    }


}
