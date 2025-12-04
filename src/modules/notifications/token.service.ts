// src/modules/notifications/token.service.ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { TokenType } from '@prisma/client';

@Injectable()
export class TokenService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectPinoLogger(TokenService.name) private readonly logger: PinoLogger,
    ) { }

    /**
     * Set or update a notification token for a user.
     * @param userId User ID
     * @param token Device token
     * @param type Token type (FCM or APNS)
     */
    async setToken(userId: bigint, agencyId: bigint, token: string, type: TokenType = TokenType.FCM): Promise<void> {
        try {

            const existingToken = await this.prisma.userNotificationToken.findFirst({
                where: { userId, token }
            });

            if (!existingToken) {
                await this.prisma.userNotificationToken.deleteMany({
                    where: { userId, type }
                });
            }

            const result = await this.prisma.userNotificationToken.create({
                data: {agencyId, userId, token, type, createdAt: new Date(), updatedAt: new Date() },
            });
           
            this.logger.info(`Set notification token for user ${userId}`);
            
        } catch (error) {
            console.log({ error });
            this.logger.error(`Failed to set token for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all notification tokens for a user.
     * @param userId User ID
     * @returns Array of tokens with types
     */
    async getTokens(userId: bigint): Promise<{ token: string; type: TokenType }[]> {
        return this.prisma.userNotificationToken.findMany({
            where: { userId },
            select: { token: true, type: true },
        });
    }
}