import { AssetDTO } from "./AssetDTO";
import { PermissionDTO } from "./PermissionDTO";

export class EncodePermissionDTO {
    private readonly asset: AssetDTO;
    private readonly permissions: PermissionDTO[];

    private constructor(asset: AssetDTO, permissions: PermissionDTO[]) {
        this.asset = asset;
        this.permissions = permissions;
    }

    /**
     * Factory method to create an instance
     */
    public static of(asset: AssetDTO, permissions: PermissionDTO[]): EncodePermissionDTO {
        return new EncodePermissionDTO(asset, permissions);
    }

    public getAsset(): AssetDTO {
        return this.asset;
    }

    public getPermissions(): PermissionDTO[] {
        return this.permissions;
    }

    public toString(): string {
        const perms = this.permissions.map(p => p.getName()).join(', ');
        return `EncodePermissionDTO{asset=${this.asset.getName()}, permissions=[${perms}]}`;
    }
}
