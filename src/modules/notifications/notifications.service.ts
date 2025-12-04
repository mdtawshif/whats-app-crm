import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Server } from 'socket.io';
import { PrismaService } from 'nestjs-prisma';
import { UserService } from '../user/user.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationType, type Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { RedisNotificationService } from './redis.notifications.service';
import { SearchUtils } from '@/utils/search.utils';
import { PubSubService, PubSubMessage } from './pubsub/pubsub.service';
import { create } from 'lodash';

@Injectable()
export class NotificationService {
  private server: Server | null = null;

  constructor(
    @InjectQueue('notifications-queue') private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly redisService: RedisNotificationService,
    private readonly pubSubService: PubSubService,
    @InjectPinoLogger(NotificationService.name) private readonly logger: PinoLogger,
  ) { }

  setServer(server: Server) {
    this.server = server;
    this.logger.info('WebSocket server set in NotificationService');
  }

  // notifications.service.ts
  async sendOfflinePush(userId: string, payload: any) {
    await this.queue.add('sendOfflinePush', { userId, payload });
    return { success: true };
  }

  private async createNotifications(userIds: bigint[], payload: {
    type: NotificationType;
    title?: string;
    message: string;
    data?: any;
    agencyId?: bigint;
    agentId?: bigint;
    navigatePath?: string;
  }) {
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          createdBy: userId,
          agentId: payload.agentId,
          agencyId: payload.agencyId,
          type: payload.type ?? NotificationType.INFO,
          title: payload.title,
          message: payload.message,
          data: payload.data,
          read: false,
          navigatePath: payload.navigatePath,
        })),
        skipDuplicates: true,
      });
      this.logger.info(`Created notifications for ${userIds.length} users`);
    } catch (error) {
      this.logger.error(`Failed to create notifications: ${error.message}`);
      throw error;
    }
  }

  async sendToUser(
    userIds: bigint | bigint[],
    agencyId: bigint,
    type: NotificationType,
    data: { title?: string; message: string; data?: any; agentId?: bigint; notificationId?: string; navigatePath?: string }
  ) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    await this.createNotifications(ids, { ...data, agencyId, type, navigatePath: data.navigatePath });

    const notificationId = data.notificationId || uuid();
    const payload = { ...data, notificationId };
    const userStatuses = await Promise.all(
      ids.map(async (id) => ({
        id: id.toString(),
        online: (await this.redisService.getUserSockets(id)).length > 0,
      })),
    );
    const onlineIds = userStatuses.filter((s) => s.online).map((s) => s.id);
    const offlineIds = userStatuses.filter((s) => !s.online).map((s) => s.id);

    if (onlineIds.length > 0) {
      const message: PubSubMessage = {
        targetType: onlineIds.length === 1 ? 'user' : 'users',
        targetId: onlineIds.length === 1 ? onlineIds[0] : undefined,
        targetIds: onlineIds.length > 1 ? onlineIds : undefined,
        event: type,
        payload,
      };
      try {
        await this.pubSubService.publish('notifications', message);
        this.logger.info(`Published ${type} to ${onlineIds.length} online users via stream`);
      } catch (error) {
        this.logger.error({ error: error.message }, 'Stream publish failed, falling back to direct emit');
        if (this.server) {
          const rooms = onlineIds.map((id) => `user-${id}`);
          this.server.to(rooms).emit(type, payload);
          this.logger.info(`Directly emitted ${type} to ${onlineIds.length} users`);
        }
      }
    }

    if (offlineIds.length > 0) {
      await this.queue.add('sendUsersOfflinePush', { userIds: offlineIds, payload }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      this.logger.info(`Queued FCM for ${offlineIds.length} offline users`);
    }
  }

  async sendToTeam(agencyId: bigint, teamId: bigint, type: NotificationType, data: { title?: string; message: string; data?: any; notificationId?: string; navigatePath?: string }) {
    const userIds = await this.userService.getUserIdsByTeam(agencyId, teamId);
    if (!userIds.length) {
      this.logger.warn(`No users found for team-${teamId}`);
      return;
    }
    await this.createNotifications(userIds, { ...data, type, navigatePath: data.navigatePath });

    const notificationId = data.notificationId || uuid();
    const payload = { ...data, notificationId };
    const online = await this.redisService.getOnlineByTeam(teamId.toString());
    const onlineCount = online.length;

    if (onlineCount > 0) {
      const message: PubSubMessage = {
        targetType: 'team',
        targetId: teamId.toString(),
        event: type,
        payload,
      };
      try {
        await this.pubSubService.publish('notifications', message);
        this.logger.info(`Published ${type} to team-${teamId} via stream (online: ${onlineCount})`);
      } catch (error) {
        this.logger.error({ error: error.message }, 'Stream publish failed, falling back to direct emit');
        if (this.server) {
          this.server.to(`team-${teamId}`).emit(type, payload);
          this.logger.info(`Directly emitted ${type} to team-${teamId}`);
        }
      }
    }

    const offlineIds = userIds.filter((id) => !online.includes(id.toString())).map((id) => id.toString());
    if (offlineIds.length > 0) {
      await this.queue.add('sendUsersOfflinePush', { userIds: offlineIds, payload }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      this.logger.info(`Queued FCM for ${offlineIds.length} offline users in team-${teamId}`);
    }
  }

  async sendToAgency(agencyId: bigint, type: NotificationType, data: { title?: string; message: string; data?: any; notificationId?: string; navigatePath?: string }) {
    let userIds: bigint[];

    if (agencyId && NotificationType.TRIGGER_ALERT) {
      // Send to all admins (INCLUDING agency admins and team admins)
      userIds = await this.userService.getUserIdsByAgencyOnlyTeamAndAdmins(agencyId);
    } else {
      userIds = await this.userService.getUserIdsByAgency(agencyId);
    }

    if (!userIds.length) {
      this.logger.warn(`No users found for agency-${agencyId}`);
      return;
    }
    console.log({ type });
    await this.createNotifications(userIds, { ...data, type, agencyId, navigatePath: data.navigatePath });

    const notificationId = data.notificationId || uuid();
    const payload = { ...data, notificationId };
    const online = await this.redisService.getOnlineByAgency(agencyId.toString());
    const onlineCount = online.length;

    if (onlineCount > 0) {
      const message: PubSubMessage = {
        targetType: 'agency',
        targetId: agencyId.toString(),
        event: type,
        payload,
      };
      try {
        await this.pubSubService.publish('notifications', message);
        this.logger.info(`Published ${type} to agency-${agencyId} via stream (online: ${onlineCount})`);
      } catch (error) {
        this.logger.error({ error: error.message }, 'Stream publish failed, falling back to direct emit');
        if (this.server) {
          this.server.to(`agency-${agencyId}`).emit(type, payload);
          this.logger.info(`Directly emitted ${type} to agency-${agencyId}`);
        }
      }
    }

    const offlineIds = userIds.filter((id) => !online.includes(id.toString())).map((id) => id.toString());
    if (offlineIds.length > 0) {
      await this.queue.add('sendUsersOfflinePush', { userIds: offlineIds, payload }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      this.logger.info(`Queued FCM for ${offlineIds.length} offline users in agency-${agencyId}`);
    }
  }

  async getNotifications(
    userId: bigint,
    query?: string,
    limit = 10,
    page = 1,
    filter?: { type?: NotificationType; read?: boolean },
  ) {

    console.log({ filter: filter, query: query });
    const skip = (page - 1) * limit;
    const baseWhere: Prisma.NotificationWhereInput = {
      userId,
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.read !== undefined ? { read: filter.read } : {}),
    };
    const where = query
      ? SearchUtils.applySearch<Prisma.NotificationWhereInput>(
        baseWhere,
        query,
        {
          fields: ['title', 'message'],
          strategy: 'ALL',
          minTermLength: 2,
          maxTerms: 5,
          caseSensitive: false
        }
      )
      : baseWhere;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notification.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    const filterWhere: Prisma.NotificationWhereInput = {
      userId,
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.read !== undefined ? { read: Boolean(filter.read) } : {}),
    };
    const filterCount = await this.prisma.notification.count({
      where: filterWhere,
    });
    return {
      data,
      total,
      totalPages,
      filterCount,
      page,
      limit
    };
  }

  async markAsRead(notificationId: bigint, userId: bigint): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
    this.logger.info(`Marked notification ${notificationId} as read for user ${userId}`);
  }

  async markAsUnread(notificationId: bigint, userId: bigint): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: false, readAt: null },
    });
    this.logger.info(`Marked notification ${notificationId} as unread for user ${userId}`);
  }

  async deleteNotification(notificationId: bigint, userId: bigint): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    this.logger.info(`Deleted notification ${notificationId} for user ${userId}`);
  }

  async deleteAllNotifications(userId: bigint): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });
    this.logger.info(`Deleted all notifications for user ${userId}`);
  }

  async getUserUnreadNotificationCount(userId: bigint): Promise<number> {
    return await this.prisma.notification.count({
      where: {
        userId,
        read: false,
        readAt: null,
      },
    });
  }
}