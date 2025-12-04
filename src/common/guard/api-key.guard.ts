import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { ApiKeyUtils } from '../../utils/api-key-generator';
// Guard for API key authentication
@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = this.extractApiKeyFromHeader(request);

        if (!apiKey) {
            throw new UnauthorizedException('API key is missing');
        }

        if (!ApiKeyUtils.validateApiKey(apiKey)) {
            throw new UnauthorizedException('Invalid API key format');
        }

        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    apiKey,
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    email: true,
                    userName: true,
                    agencyId: true,
                    teamId: true,
                    roleId: true,
                    currentCredit: true,
                },
            });

            if (!user) {
                throw new UnauthorizedException('Invalid API key');
            }

            // Attach user to request for downstream use
            request['user'] = {
                ...user,
                currentCredit: user.currentCredit.toNumber(),
            };

            return true;
        } catch (error) {
            throw new UnauthorizedException('API key authentication failed');
        }
    }

    private extractApiKeyFromHeader(request: Request): string | undefined {
        const apiKey = request.headers['x-api-key'] || request.headers['authorization'];

        if (!apiKey) {
            return undefined;
        }

        // Handle both direct API key and Bearer format
        if (typeof apiKey === 'string') {
            return apiKey.startsWith('Bearer ') ? apiKey.replace('Bearer ', '') : apiKey;
        }

        return undefined;
    }
}