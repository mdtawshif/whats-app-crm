import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { getAppConfig } from '@/config/config.utils';

@Injectable()
export class RedisNotificationService {
    private readonly client: Redis;
    private readonly USER_SESSION_TTL = 300; // 5 minutes

    constructor(
        @InjectPinoLogger(RedisNotificationService.name) private readonly logger: PinoLogger,
        private readonly configService: ConfigService
    ) {
        const appConfig = getAppConfig(this.configService);
        this.client = new Redis({
            host: appConfig.redisHost,
            port: +appConfig.redisPort,
            password: appConfig.useRedisPassword ? appConfig.redisPassword : undefined,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 50, 2000),
        });

        this.client.on('error', (err) => this.logger.error('Redis Client Error', err));
        this.client.on('connect', () => this.logger.info('Connected to Redis'));
    }

    getClient(): Redis {
        return this.client;
    }

    async clearDatabase(async = true): Promise<void> {
        try {
            const command = async ? 'FLUSHALL ASYNC' : 'FLUSHALL';
            await this.client.call(command);
            this.logger.info({ command }, 'Redis database cleared');
        } catch (error) {
            this.logger.error({ error: error.message }, 'Failed to clear Redis database');
            throw error;
        }
    }

    async clearAllSocketData(): Promise<void> {
        try {
            const socketKeys = await this.client.keys('user:*:sockets');
            if (socketKeys.length > 0) {
                await this.client.del(socketKeys);
                this.logger.info(
                    { event: 'clear_all_socket_data', keysCleared: socketKeys.length },
                    `Cleared ${socketKeys.length} socket-related keys from Redis`
                );
            } else {
                this.logger.info({ event: 'clear_all_socket_data' }, 'No socket-related keys found to clear');
            }
        } catch (error) {
            this.logger.error(
                { event: 'clear_all_socket_data_error', error: error.message, stack: error.stack },
                'Failed to clear socket-related data'
            );
            throw error;
        }
    }

    async clearCurrentDatabase(async = true): Promise<void> {
        try {
            const command = async ? 'FLUSHDB ASYNC' : 'FLUSHDB';
            await this.client.call(command);
            this.logger.info({ command }, 'Current Redis database cleared');
        } catch (error) {
            this.logger.error({ error: error.message }, 'Failed to clear current Redis database');
            throw error;
        }
    }

    async clearNotificationData(): Promise<void> {
        try {
            const keys = await this.client.keys('notifications:*');
            const userKeys = await this.client.keys('online:user:*');
            const socketKeys = await this.client.keys('user:*:sockets');
            const agencyKeys = await this.client.keys('online:agency:*');
            const teamKeys = await this.client.keys('online:team:*');
            const allKeys = [...keys, ...userKeys, ...socketKeys, ...agencyKeys, ...teamKeys, 'online:users'];

            if (allKeys.length > 0) {
                await this.client.del(allKeys);
                this.logger.info({ keys: allKeys.length }, 'Cleared notification-related keys');
            } else {
                this.logger.info('No notification-related keys to clear');
            }
        } catch (error) {
            this.logger.error({ error: error.message }, 'Failed to clear notification data');
            throw error;
        }
    }

    async getUserOnlineData(userId: bigint): Promise<{ agencyId: bigint | null; teamId: bigint | null } | null> {
        const key = `online:user:${userId}`;
        const value = await this.client.get(key);
        if (!value) return null;
        const { agencyId, teamId } = JSON.parse(value);
        return { agencyId, teamId };
    }

    // Set user online and refresh TTLs on all related keys
    async setUserOnline(
        userId: bigint,
        agencyId: bigint | null,
        teamId: bigint | null,
        ttl: number = this.USER_SESSION_TTL,
    ): Promise<void> {
        const key = `online:user:${userId}`;
        const value = JSON.stringify({
            userId,
            agencyId,
            teamId,
            lastSeen: new Date().toISOString()
        });

        await this.client.set(key, value, 'EX', ttl);

        await this.client.sadd('online:users', userId.toString());
        await this.client.expire('online:users', ttl);

        if (agencyId) {
            await this.client.sadd(`online:agency:${agencyId.toString()}`, userId.toString());
            await this.client.expire(`online:agency:${agencyId.toString()}`, ttl);
        }
        if (teamId) {
            await this.client.sadd(`online:team:${teamId.toString()}`, userId.toString());
            await this.client.expire(`online:team:${teamId.toString()}`, ttl);
        }
    }

    // Refresh TTL for all related keys (called on ping/message/connect)
    async updateUserTTL(userId: bigint, ttl: number = this.USER_SESSION_TTL): Promise<void> {
        const key = `online:user:${userId}`;
        await this.client.expire(key, ttl);

        const currentValue = await this.client.get(key);
        let agencyId: bigint | null = null;
        let teamId: bigint | null = null;

        if (currentValue) {
            const userData = JSON.parse(currentValue);
            userData.lastSeen = new Date().toISOString();
            await this.client.set(key, JSON.stringify(userData), 'EX', ttl);
            agencyId = userData.agencyId;
            teamId = userData.teamId;
        }

        await this.client.expire('online:users', ttl);

        // Refresh agency/team sets if data exists
        if (agencyId) await this.client.expire(`online:agency:${agencyId.toString()}`, ttl);
        if (teamId) await this.client.expire(`online:team:${teamId.toString()}`, ttl);

        // Also refresh sockets TTL
        await this.expireUserSocket(userId, ttl);
    }

    async setUserOffline(userId: bigint, agencyId: bigint | null = null, teamId: bigint | null = null): Promise<void> {
        const key = `online:user:${userId}`;
        const value = await this.client.get(key);
        if (value) {
            const parsed = JSON.parse(value);
            agencyId = agencyId || parsed.agencyId;
            teamId = teamId || parsed.teamId;
        }
        await this.client.srem('online:users', userId.toString());
        if (agencyId) await this.client.srem(`online:agency:${agencyId.toString()}`, userId.toString());
        if (teamId) await this.client.srem(`online:team:${teamId.toString()}`, userId.toString());
        await this.client.del(key);
        await this.client.del(`user:${userId}:sockets`);
    }

    // Store sockets in a Redis list, keep only latest 10, and set TTL
    async setUserSocket(userId: bigint, socketId: string): Promise<void> {
        const key = `user:${userId}:sockets`;
        // Defensive: If key exists and is not a list, delete it
        const type = await this.client.type(key);
        if (type && type !== 'none' && type !== 'list') {
            await this.client.del(key);
        }
        await this.client.lpush(key, socketId);
        await this.client.ltrim(key, 0, 9);
        await this.client.expire(key, this.USER_SESSION_TTL);
        this.logger.info({ userId: userId.toString(), socketId }, 'Socket associated with user');
    }

    async removeUserSocket(userId: bigint, socketId: string): Promise<void> {
        const key = `user:${userId}:sockets`;
        await this.client.lrem(key, 0, socketId);
        await this.client.expire(key, this.USER_SESSION_TTL);
        const remainingSockets = await this.getUserSockets(userId);
        this.logger.info({ userId: userId.toString(), socketId, remainingSockets }, 'Socket removed from user');
    }

    async cleanUserSockets(userId: bigint): Promise<void> {
        const key = `user:${userId}:sockets`;
        const cardinality = await this.client.llen(key);
        if (cardinality === 0) {
            await this.client.del(key);
            this.logger.info({ userId: userId.toString() }, 'Cleaned empty socket set');
        } else {
            await this.client.expire(key, this.USER_SESSION_TTL);
            this.logger.warn({ userId: userId.toString(), cardinality }, 'Socket set not empty, skipping cleanup');
        }
    }

    async getUserSockets(userId: bigint): Promise<string[]> {
        const key = `user:${userId}:sockets`;
        const sockets = await this.client.lrange(key, 0, 9); // Latest 10 sockets
        this.logger.debug({ userId: userId.toString(), sockets }, 'Retrieved user sockets');
        return sockets;
    }

    async expireUserSocket(userId: bigint, ttl: number = this.USER_SESSION_TTL) {
        const key = `user:${userId}:sockets`;
        await this.client.expire(key, ttl);
    }

    async getInactiveUsers(ttl: number = this.USER_SESSION_TTL): Promise<bigint[]> {
        const inactiveUsers: bigint[] = [];
        const keys = await this.client.keys('online:user:*');

        for (const key of keys) {
            const ttlRemaining = await this.client.ttl(key);
            if (ttlRemaining === -2) continue; // Key doesn't exist
            if (ttlRemaining <= 0) {
                const userId = key.split(':').pop();
                inactiveUsers.push(BigInt(userId));
            }
        }
        return inactiveUsers;
    }

    async getOnlineByAgency(agencyId: string): Promise<string[]> {
        const key = `online:agency:${agencyId}`;
        await this.client.expire(key, this.USER_SESSION_TTL);
        return this.client.smembers(key);
    }

    async getOnlineByTeam(teamId: string): Promise<string[]> {
        const key = `online:team:${teamId}`;
        await this.client.expire(key, this.USER_SESSION_TTL);
        return this.client.smembers(key);
    }

    async getAllOnlineUsers(): Promise<string[]> {
        const key = 'online:users';
        await this.client.expire(key, this.USER_SESSION_TTL);
        return this.client.smembers(key);
    }
}