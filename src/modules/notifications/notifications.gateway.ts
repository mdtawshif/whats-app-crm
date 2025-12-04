import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisNotificationService } from './redis.notifications.service';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { NotificationService } from './notifications.service';
import { TypedSocketWithUser } from '../../types/socket';
import { PubSubService } from './pubsub/pubsub.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || '*',
    credentials: true,
  },
  path: '/notifications',
  transports: ['websocket'],
  pingTimeout: 20000,
  pingInterval: 25000,
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly USER_SESSION_TTL = 300; // 5 minutes in seconds
  private readonly HEARTBEAT_INTERVAL = 60000; // 1 minute in milliseconds
  private heartbeatInterval: NodeJS.Timeout;
  private pingInterval = 60000; // 1 minute for client ping
  private subscriptionChannel = 'notifications'; // Channel name for pub/sub

  constructor(
    @InjectPinoLogger(NotificationsGateway.name) private readonly logger: PinoLogger,
    private readonly wsAuthMiddleware: WsAuthMiddleware,
    private readonly redisService: RedisNotificationService,
    private readonly notificationService: NotificationService,
    private readonly pubSubService: PubSubService,
  ) {
    this.logger.info({ event: 'gateway.instantiated' }, 'NotificationsGateway instantiated');
  }

  afterInit(server: Server) {
    const client = this.redisService.getClient();
    const subClient = client.duplicate();
    server.adapter(
      createAdapter(client, subClient, {
        requestsTimeout: 5000,
        key: 'notifications:',
      }),
    );
    server.use((socket: Socket, next) => this.wsAuthMiddleware.use(socket, next));
    this.notificationService.setServer(server);

    // Subscribe to notifications channel using Redis Pub/Sub
    this.pubSubService.subscribe(this.subscriptionChannel, async (message) => {
      const { targetType, targetId, targetIds, event, payload } = message;
      let rooms: string[] = [];
      if (targetType === 'user') {
        rooms = [`user-${targetId}`];
      } else if (targetType === 'users') {
        rooms = targetIds.map((id: string) => `user-${id}`);
      } else if (targetType === 'team') {
        rooms = [`team-${targetId}`];
      } else if (targetType === 'agency') {
        rooms = [`agency-${targetId}`];
      }
      if (rooms.length > 0) {
        this.server.to(rooms).emit(event, payload);
        this.logger.info({ event, rooms }, 'Emitted via pubsub WebSocket');
      }
    });

    this.heartbeatInterval = setInterval(() => this.checkInactiveUsers(), this.HEARTBEAT_INTERVAL);
    this.logger.info({ event: 'gateway.initialized' }, 'Notifications WebSocket Gateway initialized with Redis adapter');
  }

  async handleConnection(client: TypedSocketWithUser) {
    try {
      const user = client.data?.user;
      if (!user || !user.userId) {
        this.logger.warn({ event: 'connection.unauthenticated', socketId: client.id }, 'Connection attempt without valid user data');
        client.disconnect(true);
        return;
      }
      client.join(`user-${user.userId}`);
      if (user.agencyId) client.join(`agency-${user.agencyId}`);

      await this.redisService.setUserSocket(user.userId, client.id);
      await this.redisService.setUserOnline(user.userId, user.agencyId, "" as any, this.USER_SESSION_TTL);

      this.logger.info(
        {
          event: 'connection.success',
          socketId: client.id,
          userId: user.userId.toString(),
          agencyId: user.agencyId?.toString() || null,
        },
        'User connected',
      );
      client.emit('connected', {
        message: 'WebSocket connection established',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        {
          event: 'connection.error',
          socketId: client.id,
          error: error.message,
          stack: error.stack,
        },
        'Connection failed',
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: TypedSocketWithUser) {
    try {
      const user = client.data?.user;
      if (!user || !user.userId) {
        this.logger.warn(
          { event: 'disconnect.unauthenticated', socketId: client.id },
          'Disconnect attempt without valid user data',
        );
        return;
      }
      await this.redisService.removeUserSocket(user.userId, client.id);
      const remainingSockets = await this.redisService.getUserSockets(user.userId);
      this.logger.debug(
        {
          event: 'disconnect',
          socketId: client.id,
          userId: user.userId.toString(),
          agencyId: user.agencyId?.toString() || null,
          remainingSockets,
        },
        'User disconnect processed',
      );
      if (remainingSockets.length === 0) {
        await this.redisService.setUserOffline(user.userId, user.agencyId);
        await this.redisService.cleanUserSockets(user.userId);
        this.logger.info(
          {
            event: 'disconnect.last_socket',
            socketId: client.id,
            userId: user.userId.toString(),
            agencyId: user.agencyId?.toString() || null,
          },
          'User disconnected (last socket)',
        );
      } else {
        this.logger.warn(
          {
            event: 'disconnect.partial',
            socketId: client.id,
            userId: user.userId.toString(),
            agencyId: user.agencyId?.toString() || null,
            remainingSockets,
          },
          'User disconnected (sockets remaining)',
        );
        // Retry cleanup to ensure no stale sockets
        await this.redisService.removeUserSocket(user.userId, client.id);
        const finalSockets = await this.redisService.getUserSockets(user.userId);
        if (finalSockets.length === 0) {
          await this.redisService.setUserOffline(user.userId, user.agencyId);
          await this.redisService.cleanUserSockets(user.userId);
          this.logger.info(
            {
              event: 'disconnect.retry_success',
              socketId: client.id,
              userId: user.userId.toString(),
              agencyId: user.agencyId?.toString() || null,
            },
            'Retry cleanup removed all sockets',
          );
        } else {
          this.logger.error(
            {
              event: 'disconnect.retry_failed',
              socketId: client.id,
              userId: user.userId.toString(),
              agencyId: user.agencyId?.toString() || null,
              remainingSockets: finalSockets,
            },
            'Failed to clean up all sockets after retry',
          );
        }
      }
    } catch (error) {
      this.logger.error(
        {
          event: 'disconnect.error',
          socketId: client.id,
          error: error.message,
          stack: error.stack,
        },
        'Disconnection failed',
      );
    }
  }

  @SubscribeMessage('ping')
  async handlePing(client: TypedSocketWithUser) {
    try {
      const user = client.data?.user;
      if (!user || !user.userId) {
        this.logger.warn(
          { event: 'ping.unauthenticated', socketId: client.id },
          'Ping attempt without valid user data',
        );
        return;
      }
      // Refresh TTL for all user/session/socket keys
      await this.redisService.updateUserTTL(user.userId, this.USER_SESSION_TTL);

      this.logger.info(
        {
          event: 'ping.received',
          socketId: client.id,
          userId: user.userId.toString(),
          agencyId: user.agencyId?.toString() || null,
        },
        'User ping received',
      );
      client.emit('pong', {
        timestamp: new Date().toISOString(),
        nextPing: new Date(Date.now() + this.pingInterval).toISOString(),
      });
    } catch (error) {
      this.logger.error(
        {
          event: 'ping.error',
          socketId: client.id,
          error: error.message,
          stack: error.stack,
        },
        'Ping processing failed',
      );
    }
  }

  @SubscribeMessage('message_sent')
  async handleCustomEvent(client: TypedSocketWithUser, data: { targetId: bigint; message: string; type: string }) {
    const user = client.data?.user;
    try {
      if (!user || !user.userId) {
        this.logger.warn(
          { event: 'message.unauthenticated', socketId: client.id },
          'Message send attempt without valid user data',
        );
        client.emit('error', { message: 'Unauthorized' });
        return;
      }
      await this.redisService.updateUserTTL(user.userId, this.USER_SESSION_TTL);
      this.server.to(`user-${data.targetId}`).emit(data.type, {
        senderId: user.userId,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
      this.logger.info(
        {
          event: 'message.sent',
          socketId: client.id,
          userId: user.userId.toString(),
          targetId: data.targetId.toString(),
          messageType: data.type,
        },
        'Message sent to target user',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'message.error',
          socketId: client.id,
          userId: user?.userId?.toString() || 'unknown',
          targetId: data?.targetId?.toString() || 'unknown',
          error: error.message,
          stack: error.stack,
        },
        'Message send failed',
      );
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  private async checkInactiveUsers(): Promise<void> {
    try {
      const inactiveUsers = await this.redisService.getInactiveUsers(this.USER_SESSION_TTL);
      if (inactiveUsers.length > 0) {
        this.logger.info(
          { event: 'inactive_users.check', inactiveCount: inactiveUsers.length },
          `Found ${inactiveUsers.length} inactive users`,
        );
        for (const userId of inactiveUsers) {
          const userData = await this.redisService.getUserOnlineData(userId);
          await this.redisService.setUserOffline(userId, userData?.agencyId, userData?.teamId);
          await this.redisService.cleanUserSockets(userId);
          this.logger.info(
            { event: 'inactive_users.offline', userId: userId.toString() },
            `User marked offline due to inactivity`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        {
          event: 'inactive_users.error',
          error: error.message,
          stack: error.stack,
        },
        'Failed to check inactive users',
      );
    }
  }

  async onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Unsubscribe from notifications channel
    this.pubSubService.unsubscribe(this.subscriptionChannel);

    try {

      await this.redisService.clearNotificationData(); // Only your keys
      this.logger.info({ event: 'gateway.destroyed' }, 'WebSocket gateway resources cleaned up, including socket data');
    } catch (error) {
      this.logger.error(
        { event: 'gateway.destroy_error', error: error.message, stack: error.stack },
        'Failed to clean up socket data during gateway destruction'
      );
    }
  }
}