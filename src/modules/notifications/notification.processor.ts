import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserService } from '../user/user.service';
import * as admin from 'firebase-admin';
import { PrismaService } from 'nestjs-prisma';
import { TokenType } from '@prisma/client';

interface NotificationPayload {
    title?: string;
    message: string;
    data?: Record<string, any>;
    imageUrl?: string;
    deepLink?: string;
}

interface NotificationJobData {
    userId?: string;
    teamId?: string;
    agencyId?: string;
    userIds?: string[];
    payload: NotificationPayload;
    priority?: 'high' | 'normal';
    ttl?: number; // Time to live in seconds
}

interface UserNotificationToken {
    token: string;
    type: TokenType;
}

@Injectable()
@Processor('notifications-queue')
export class NotificationProcessor extends WorkerHost {
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 2000;
    private readonly BATCH_SIZE = 500; // FCM multicast limit

    constructor(
        private readonly prisma: PrismaService,
        private readonly userService: UserService,
        private readonly logger: PinoLogger,
    ) {
        super();
        this.logger.setContext(NotificationProcessor.name);
    }

    onModuleInit() {
        this.logger.info('[NotificationProcessor] Initialized');
    }

    async process(job: Job<NotificationJobData>) {
        this.logger.info({
            jobName: job.name,
            jobId: job.id,
            jobData: job.data,
            msg: `Processing job: ${job.name}`,
        });

        try {
            switch (job.name) {
                case 'sendOfflinePush':
                    if (!job.data.userId) throw new Error('Missing userId');
                    await this.handleSendPush(BigInt(job.data.userId), job.data.payload, job.data.priority, job.data.ttl);
                    break;
                case 'sendTeamOfflinePush':
                    if (!job.data.teamId) throw new Error('Missing teamId');
                    await this.handleSendGroupPush(job.data.teamId, job.data.payload, 'team', job.data.priority, job.data.ttl);
                    break;
                case 'sendAgencyOfflinePush':
                    if (!job.data.agencyId) throw new Error('Missing agencyId');
                    await this.handleSendGroupPush(job.data.agencyId, job.data.payload, 'agency', job.data.priority, job.data.ttl);
                    break;
                case 'sendUsersOfflinePush':
                    if (!job.data.userIds?.length) throw new Error('Missing userIds');
                    await this.handleSendUsersPush(job.data.userIds, job.data.payload, job.data.priority, job.data.ttl);
                    break;
                default:
                    this.logger.warn({ jobName: job.name, msg: 'Unknown job type' });
            }
        } catch (error) {
            this.logger.error({
                error: error instanceof Error ? error.message : 'Unknown error',
                jobId: job.id,
                msg: 'Job processing failed',
            });
            throw error; // Rethrow for BullMQ retry mechanism
        }
    }

    private async handleSendPush(
        userId: bigint,
        payload: NotificationPayload,
        priority: 'high' | 'normal' = 'high',
        ttl: number = 2419200, // 28 days default
    ) {
        const tokens = await this.prisma.userNotificationToken.findMany({
            where: { userId, type: TokenType.FCM },
            select: { token: true, type: true },
        });

        if (!tokens.length) {
            this.logger.info({ userId, msg: 'No FCM tokens found for user' });
            return;
        }

        await this.sendPushWithRetry(tokens, payload, priority, ttl);
    }

    private async handleSendGroupPush(
        groupId: string,
        payload: NotificationPayload,
        type: 'team' | 'agency',
        priority: 'high' | 'normal' = 'high',
        ttl: number = 2419200,
    ) {
        const getUsers = type === 'team'
            ? this.userService.getUserIdsByTeam
            : this.userService.getUserIdsByAgency;

        const userIds = await getUsers.call(this.userService, groupId);
        if (!userIds.length) {
            this.logger.info({ groupId, type, msg: `No users found for ${type} push` });
            return;
        }

        const tokens = await this.prisma.userNotificationToken.findMany({
            where: { userId: { in: userIds.map(BigInt) }, type: TokenType.FCM },
            select: { token: true, type: true },
        });

        if (!tokens.length) {
            this.logger.info({ groupId, type, msg: `No FCM tokens found for ${type}` });
            return;
        }

        await this.sendPushWithRetry(tokens, payload, priority, ttl);
    }

    private async handleSendUsersPush(
        userIds: string[],
        payload: NotificationPayload,
        priority: 'high' | 'normal' = 'high',
        ttl: number = 2419200,
    ) {
        const tokens = await this.prisma.userNotificationToken.findMany({
            where: { userId: { in: userIds.map(BigInt) }, type: TokenType.FCM },
            select: { token: true, type: true },
        });

        if (!tokens.length) {
            this.logger.info({ userIds, msg: 'No FCM tokens found for users' });
            return;
        }

        await this.sendPushWithRetry(tokens, payload, priority, ttl);
    }

    private async sendPushWithRetry(
        tokens: UserNotificationToken[],
        payload: NotificationPayload,
        priority: 'high' | 'normal',
        ttl: number,
        attempt = 1,
    ) {
        try {
            await this.sendPush(tokens, payload, priority, ttl);
        } catch (error) {
            if (attempt < this.MAX_RETRIES) {
                this.logger.warn({
                    attempt,
                    maxRetries: this.MAX_RETRIES,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    msg: 'FCM send failed, retrying...',
                });

                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * attempt));
                return this.sendPushWithRetry(tokens, payload, priority, ttl, attempt + 1);
            }
            throw error;
        }
    }

    private async sendPush(
        tokens: UserNotificationToken[],
        payload: NotificationPayload,
        priority: 'high' | 'normal',
        ttl: number,
    ) {
        // Split tokens into batches to respect FCM limits
        for (let i = 0; i < tokens.length; i += this.BATCH_SIZE) {
            const batch = tokens.slice(i, i + this.BATCH_SIZE);
            await this.sendBatch(batch, payload, priority, ttl);
        }
    }

    private async sendBatch(
        tokens: UserNotificationToken[],
        payload: NotificationPayload,
        priority: 'high' | 'normal',
        ttl: number,
    ) {
        const fcmTokens = tokens.map(t => t.token);

        // Prepare consistent data payload for background processing
        const dataPayload = {
            title: payload.title || 'Notification',
            body: payload.message,
            ...(payload.deepLink && { deepLink: payload.deepLink }),
            ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
            ...payload.data, // Include any additional data
        };

        // Prepare platform-specific messages
        const message: admin.messaging.MulticastMessage = {
            tokens: fcmTokens,
            // User-facing notification (shown when app is in background/closed)
            notification: {
                title: payload.title || 'Notification',
                body: payload.message,
                imageUrl: payload.imageUrl,
            },
            // Data payload (delivered to app in all states)
            data: dataPayload,
            // Android-specific settings
            android: {
                priority,
                ttl: ttl * 1000, // Convert to milliseconds
                notification: {
                    channelId: 'high_importance_channel',
                    priority: priority === 'high' ? 'max' : 'default',
                    visibility: 'public',
                    sound: 'default',
                },
            },
            // iOS-specific settings
            apns: {
                headers: {
                    'apns-priority': priority === 'high' ? '10' : '5',
                    'apns-expiration': `${Math.floor(Date.now() / 1000) + ttl}`,
                },
                payload: {
                    aps: {
                        // User-facing notification
                        alert: {
                            title: payload.title || 'Notification',
                            body: payload.message,
                        },
                        badge: 1,
                        sound: 'default',
                        // Background processing flag
                        'content-available': 1,
                        mutableContent: true,
                    },
                },
            },
            // Web-specific settings
            webpush: {
                headers: {
                    TTL: `${ttl}`,
                    Urgency: priority === 'high' ? 'high' : 'normal',
                },
                notification: {
                    title: payload.title || 'Notification',
                    body: payload.message,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    image: payload.imageUrl,
                    data: payload.deepLink ? { url: payload.deepLink } : undefined,
                    requireInteraction: true,
                    actions: payload.deepLink ? [
                        {
                            action: 'open',
                            title: 'Open',
                        },
                    ] : undefined,
                },
                fcmOptions: {
                    link: payload.deepLink,
                },
            },
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);

            this.logger.info({
                successCount: response.successCount,
                failureCount: response.failureCount,
                tokensCount: fcmTokens.length,
                msg: `FCM push sent to ${fcmTokens.length} tokens`,
            });

            if (response.failureCount > 0) {
                await this.handleFailedTokens(response, fcmTokens);
            }
        } catch (error) {
            this.logger.error({
                error: error instanceof Error ? error.message : 'Unknown error',
                tokensCount: fcmTokens.length,
                msg: 'Failed to send FCM push notification',
            });
            throw error;
        }
    }

    private async handleFailedTokens(
        response: admin.messaging.BatchResponse,
        fcmTokens: string[],
    ) {
        const failedTokens: string[] = [];
        const invalidTokens: string[] = [];
        const retryableErrors: string[] = [];

        response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error) {
                const token = fcmTokens[idx];
                const errorCode = resp.error.code;

                // Handle specific error codes
                if (errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered') {
                    invalidTokens.push(token);
                } else if (errorCode === 'messaging/unavailable' ||
                    errorCode === 'messaging/internal-error') {
                    retryableErrors.push(token);
                } else {
                    failedTokens.push(token);
                }

                this.logger.warn({
                    token,
                    errorCode,
                    errorMsg: resp.error.message,
                    msg: 'FCM push failed for token',
                });
            }
        });

        // Remove invalid tokens immediately
        if (invalidTokens.length > 0) {
            await this.prisma.userNotificationToken.deleteMany({
                where: { token: { in: invalidTokens } },
            });
            this.logger.info({
                invalidTokens: invalidTokens.length,
                msg: `Removed ${invalidTokens.length} invalid FCM tokens`,
            });
        }

        // Log retryable errors (they'll be handled by the retry mechanism)
        if (retryableErrors.length > 0) {
            this.logger.warn({
                retryableTokens: retryableErrors.length,
                msg: `${retryableErrors.length} tokens failed with retryable errors`,
            });
        }

        // Log other failures
        if (failedTokens.length > 0) {
            this.logger.warn({
                failedTokens: failedTokens.length,
                msg: `${failedTokens.length} tokens failed with non-retryable errors`,
            });
        }
    }
}