import { ASSETS, PERMISSIONS } from "./global-constant";

export class PermissionRegistry {

    private static counter = 0n; // using BigInt for future-proof bitmask
    private static map = new Map<string, bigint>();
    private static mutex = Promise.resolve(); // ensures async safety

    /**
     * Register a permission for an asset.
     * Thread-safe: concurrent async calls won't produce duplicate IDs.
     * Returns the unique bitmask value for this permission.
     */
    static async register(assetName: string, permissionName: string): Promise<bigint> {
        const key = `${assetName}:${permissionName}`;

        if (this.map.has(key)) {
            return this.map.get(key)!;
        }

        // Lock for async safety
        await this.mutex;
        let release: () => void;
        this.mutex = new Promise(res => (release = res!));

        try {
            if (!this.map.has(key)) {
                // Use bitmask: 2^counter
                const value = 1n << this.counter;
                this.map.set(key, value);
                this.counter++;
            }
            return this.map.get(key)!;
        } finally {
            release();
        }
    }

    /**
     * Get permission bitmask by asset and permission name
     */
    static get(assetName: string, permissionName: string): bigint | undefined {
        return this.map.get(`${assetName}:${permissionName}`);
    }

    /**
     * Initialize registry with all assets and permissions.
     * Call this once at app startup.
     */
    static async init(): Promise<void> {

        for (const asset of ASSETS) {
            for (const perm of PERMISSIONS) {
                await this.register(asset.name, perm.name);
            }
        }
    }

    /**
     * Get all registered permissions
     */
    static all(): Map<string, bigint> {
        return new Map(this.map);
    }
}

// Auto-init on module load (optional)
PermissionRegistry.init().then(() => {
    console.log(' PermissionRegistry initialized with default assets & permissions');
});
