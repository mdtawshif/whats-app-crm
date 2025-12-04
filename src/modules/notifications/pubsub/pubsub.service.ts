
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Redis, RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { getAppConfig } from '@/config/config.utils';

export interface PubSubMessage {
    targetType: 'user' | 'users' | 'team' | 'agency';
    targetId?: string;
    targetIds?: string[];
    event: string;
    payload: any;
}

type MessageHandler = (message: PubSubMessage) => Promise<void>;

@Injectable()
export class PubSubService implements OnModuleDestroy {
    private readonly client: Redis;
    private subscriptions: Map<string, MessageHandler> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // 1 second initial delay

    constructor(
        @InjectPinoLogger(PubSubService.name) private readonly logger: PinoLogger,
        private readonly configService: ConfigService,
    ) {
        const appConfig = getAppConfig(this.configService);
        const options: RedisOptions = {
            host: appConfig.redisHost,
            port: +appConfig.redisPort,
            password: appConfig.useRedisPassword ? appConfig.redisPassword : undefined,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 50, 2000),
        };
        this.client = new Redis(options);
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.client.on('error', (err) => {
            this.logger.error('Redis Client Error', err);
            this.handleReconnection();
        });

        this.client.on('connect', () => {
            this.logger.info('Connected to Redis for Pub/Sub');
            this.reconnectAttempts = 0;
            // Resubscribe to all channels after reconnection
            this.resubscribeAllChannels();
        });

        this.client.on('message', (channel, message) => {
            this.handleMessage(channel, message);
        });
    }

    private async handleReconnection(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

        this.logger.warn(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(async () => {
            try {
                await this.client.connect();
            } catch (error) {
                this.logger.error('Reconnection failed', error);
                this.handleReconnection(); // Try again
            }
        }, delay);
    }

    private async resubscribeAllChannels(): Promise<void> {
        try {
            const channels = Array.from(this.subscriptions.keys());
            if (channels.length > 0) {
                await this.client.subscribe(...channels);
                this.logger.info({ channels }, 'Resubscribed to all channels');
            }
        } catch (error) {
            this.logger.error('Failed to resubscribe to channels', error);
        }
    }

    private async handleMessage(channel: string, message: string): Promise<void> {
        try {
            const handler = this.subscriptions.get(channel);
            if (!handler) {
                this.logger.warn({ channel }, 'No handler found for channel');
                return;
            }

            const pubSubMessage = JSON.parse(message) as PubSubMessage;
            await handler(pubSubMessage);
        } catch (error) {
            this.logger.error({ channel, error: error.message }, 'Error processing pub/sub message');
        }
    }

    async publish(channel: string, message: PubSubMessage): Promise<number> {
        try {
            const messageStr = JSON.stringify(message);
            const numSubscribers = await this.client.publish(channel, messageStr);
            this.logger.info({ channel, numSubscribers }, 'Published to channel');
            return numSubscribers;
        } catch (error) {
            this.logger.error({ channel, error: error.message }, 'Publish failed');
            throw error;
        }
    }

    async subscribe(
        channel: string,
        handler: MessageHandler,
    ): Promise<void> {
        if (this.subscriptions.has(channel)) {
            this.logger.warn({ channel }, 'Already subscribed to channel');
            return;
        }

        try {
            this.subscriptions.set(channel, handler);
            await this.client.subscribe(channel);
            this.logger.info({ channel }, 'Subscribed to channel');
        } catch (error) {
            this.subscriptions.delete(channel);
            this.logger.error({ channel, error: error.message }, 'Subscription failed');
            throw error;
        }
    }

    unsubscribe(channel: string): void {
        if (!this.subscriptions.has(channel)) {
            this.logger.warn({ channel }, 'Not subscribed to channel');
            return;
        }

        this.subscriptions.delete(channel);
        this.client.unsubscribe(channel)
            .then(() => this.logger.info({ channel }, 'Unsubscribed from channel'))
            .catch(error => this.logger.error({ channel, error: error.message }, 'Unsubscribe failed'));
    }

    async onModuleDestroy() {
        // Unsubscribe from all channels
        const channels = Array.from(this.subscriptions.keys());
        if (channels.length > 0) {
            await this.client.unsubscribe(...channels);
        }

        // Close Redis connection
        await this.client.quit();
        this.logger.info('Redis Pub/Sub resources cleaned up');
    }
}



// import { Injectable, OnModuleDestroy } from '@nestjs/common';
// import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
// import { Redis, RedisOptions } from 'ioredis';
// import { ConfigService } from '@nestjs/config';
// import { getAppConfig } from '@/config/config.utils';

// interface StreamMessage {
//     id: string;
//     fields: Record<string, string>;
// }

// export interface PubSubMessage {
//     targetType: 'user' | 'users' | 'team' | 'agency';
//     targetId?: string;
//     targetIds?: string[];
//     event: string;
//     payload: any;
// }

// type MessageHandler = (message: PubSubMessage, id: string, stream: string, group: string) => Promise<void>;

// @Injectable()
// export class PubSubService implements OnModuleDestroy {
//     private readonly client: Redis;
//     private consumers: Map<string, boolean> = new Map();
//     private consumerLoops: Map<string, Promise<void>> = new Map();
//     private trimmers: Map<string, NodeJS.Timeout> = new Map();

//     constructor(
//         @InjectPinoLogger(PubSubService.name) private readonly logger: PinoLogger,
//         private readonly configService: ConfigService,
//     ) {
//         const appConfig = getAppConfig(this.configService);
//         const options: RedisOptions = {
//             host: appConfig.redisHost,
//             port: +appConfig.redisPort,
//             password: appConfig.useRedisPassword ? appConfig.redisPassword : undefined,
//             maxRetriesPerRequest: 3,
//             retryStrategy: (times) => Math.min(times * 50, 2000),
//         };
//         this.client = new Redis(options);
//         this.client.on('error', (err) => this.logger.error('Redis Stream Client Error', err));
//         this.client.on('connect', () => this.logger.info('Connected to Redis for Streams'));

//         // Start trimmer for notifications-stream (1hr max age, trim every 5min)
//         this.startTrimmer('notifications-stream', 5 * 60 * 1000, 60 * 60 * 1000);
//     }

//     async publish(stream: string, message: PubSubMessage): Promise<string> {
//         try {
//             const id = await this.client.xadd(stream, '*', 'payload', JSON.stringify(message));
//             this.logger.info({ stream, id }, 'Published to stream');
//             return id;
//         } catch (error) {
//             this.logger.error({ error: error.message }, 'Publish failed');
//             throw error;
//         }
//     }

//     async subscribe(
//         stream: string,
//         group: string,
//         consumer: string,
//         handler: MessageHandler,
//     ): Promise<void> {
//         if (this.consumers.has(consumer)) return;
//         this.consumers.set(consumer, true);

//         // Ensure stream and group exist
//         try {
//             const streamExists = await this.client.exists(stream);
//             if (!streamExists) {
//                 await this.client.xadd(stream, '*', 'init', 'stream-created');
//                 this.logger.info({ stream }, 'Created stream');
//             }

//             try {
//                 await this.client.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
//                 this.logger.info({ stream, group }, 'Created consumer group');
//             } catch (error) {
//                 if (error.message.includes('BUSYGROUP')) {
//                     this.logger.info({ stream, group }, 'Consumer group already exists');
//                 } else {
//                     this.logger.warn({ stream, group, error: error.message }, 'Group creation failed');
//                 }
//             }
//         } catch (error) {
//             this.logger.error({ stream, group, error: error.message }, 'Failed to ensure stream/group');
//             this.consumers.set(consumer, false);
//             throw error;
//         }

//         const loop = this.consumeLoop(stream, group, consumer, handler);
//         this.consumerLoops.set(consumer, loop);
//         this.logger.info({ stream, group, consumer }, 'Subscribed to stream');
//     }

//     private async consumeLoop(
//         stream: string,
//         group: string,
//         consumer: string,
//         handler: MessageHandler,
//     ): Promise<void> {
//         while (this.consumers.get(consumer)) {
//             try {
//                 // Autoclaim pending messages older than 10s
//                 const autoclaimResult: [string, [string, string[]][]] = await this.client.call('XAUTOCLAIM', stream, group, consumer, '10000', '0-0', 'COUNT', '10') as any;
//                 const claimedMessages: StreamMessage[] = (autoclaimResult[1] || []).map(([id, fields]) => ({
//                     id,
//                     fields: this.arrayToObj(fields),
//                 }));
//                 if (claimedMessages.length > 0) {
//                     await this.handleBatchMessages(claimedMessages, stream, group, handler);
//                 }

//                 // Read new messages
//                 const resultsRaw: [string, [string, string[]][]][] | null = await this.client.call('XREADGROUP', 'GROUP', group, consumer, 'BLOCK', '5000', 'COUNT', '10', 'STREAMS', stream, '>') as any;
//                 if (resultsRaw && resultsRaw.length > 0) {
//                     const messages: StreamMessage[] = resultsRaw.flatMap(([_, msgs]) =>
//                         msgs.map(([id, fields]) => ({
//                             id,
//                             fields: this.arrayToObj(fields),
//                         }))
//                     );
//                     if (messages.length > 0) {
//                         await this.handleBatchMessages(messages, stream, group, handler);
//                     }
//                 }
//             } catch (error) {
//                 if (error.message.includes('NOGROUP')) {
//                     this.logger.warn({ stream, group, consumer, error: error.message }, 'No stream/group, attempting to recreate');
//                     try {
//                         await this.client.xadd(stream, '*', 'init', 'stream-created');
//                         await this.client.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
//                     } catch (err) {
//                         if (!err.message.includes('BUSYGROUP')) {
//                             this.logger.error({ stream, group, consumer, error: err.message }, 'Failed to recreate stream/group, stopping consumer');
//                             this.consumers.set(consumer, false);
//                             break;
//                         }
//                     }
//                 } else {
//                     this.logger.error({ stream, group, consumer, error: error.message }, 'Consume loop error');
//                 }
//                 await new Promise(res => setTimeout(res, 2000));
//             }
//             await new Promise(res => setTimeout(res, 10)); // Let the event loop breathe
//         }
//         this.logger.info({ stream, group, consumer }, 'Stopped consumer');
//     }

//     private async handleBatchMessages(
//         messages: StreamMessage[],
//         stream: string,
//         group: string,
//         handler: MessageHandler,
//     ) {
//         // Batch ack/delete
//         const ids: string[] = [];
//         for (const msg of messages) {
//             try {
//                 const payload = JSON.parse(msg.fields['payload'] || '{}') as PubSubMessage;
//                 await handler(payload, msg.id, stream, group);
//                 ids.push(msg.id);
//             } catch (error) {
//                 this.logger.error({ stream, id: msg.id, error: error.message }, 'Message handler error');
//             }
//         }
//         if (ids.length) {
//             await this.client.xack(stream, group, ...ids);
//             await this.client.xdel(stream, ...ids);
//         }
//     }

//     stopConsumer(consumer: string): void {
//         this.consumers.set(consumer, false);
//     }

//     private startTrimmer(
//         stream: string,
//         intervalMs: number,
//         maxAgeMs: number,
//         fallbackMaxLen: number = 10000
//     ): void {
//         if (this.trimmers.has(stream)) return;

//         const timer = setInterval(async () => {
//             try {
//                 const cutoffTs = Date.now() - maxAgeMs;
//                 const minId = `${cutoffTs}-0`;
//                 await this.client.call('XTRIM', stream, 'MINID', '~', minId);
//                 this.logger.info({ stream, minId }, 'Stream trimmed via MINID');
//             } catch (err: any) {
//                 const msg = err.message || String(err);
//                 this.logger.warn({ stream, error: msg }, 'MINID trim failed, trying MAXLEN fallback');

//                 try {
//                     await this.client.call('XTRIM', stream, 'MAXLEN', '~', fallbackMaxLen.toString());
//                     this.logger.info({ stream, fallbackMaxLen }, 'Stream trimmed via MAXLEN fallback');
//                 } catch (err2: any) {
//                     this.logger.error({ stream, error: err2.message }, 'Fallback MAXLEN trim also failed');
//                 }
//             }
//         }, intervalMs);

//         this.trimmers.set(stream, timer);
//     }



//     private arrayToObj(arr: string[]): Record<string, string> {
//         const obj: Record<string, string> = {};
//         for (let i = 0; i < arr.length; i += 2) {
//             obj[arr[i]] = arr[i + 1] || '';
//         }
//         return obj;
//     }

//     async onModuleDestroy() {
//         for (const [consumer, _] of this.consumers) {
//             this.stopConsumer(consumer);
//         }
//         await Promise.all([...this.consumerLoops.values()]); // Wait for loops to exit
//         for (const timer of this.trimmers.values()) {
//             clearInterval(timer);
//         }
//         await this.client.quit();
//         this.logger.info('Redis Stream resources cleaned up');
//     }
// }

