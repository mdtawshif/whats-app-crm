import { randomBytes } from 'crypto';

// Interface for API key generation options
interface ApiKeyOptions {
    prefix?: string;
    length?: number;
    includeTimestamp?: boolean;
}

// Utility class for API key operations
export class ApiKeyUtils {
    // Generate a secure, global-standard API key
    public static generateApiKey(options: ApiKeyOptions = {}): string {
        const {
            prefix = 'sk_',
            length = 32,
            includeTimestamp = true,
        } = options;

        // Generate random bytes for secure key
        const randomPart = randomBytes(Math.ceil(length / 2))
            .toString('hex')
            .slice(0, length);

        // Optionally include timestamp for uniqueness
        const timestampPart = includeTimestamp ? `${Date.now()}_` : '';

        // Combine prefix, timestamp (if included), and random part
        return `${prefix}${timestampPart}${randomPart}`;
    }

    // Validate API key format
    public static validateApiKey(apiKey: string, prefix: string = 'sk_'): boolean {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // Basic format validation
        const regex = new RegExp(`^${prefix}[a-zA-Z0-9_]+$`);
        return regex.test(apiKey) && apiKey.length >= 16;
    }
}