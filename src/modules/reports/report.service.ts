import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import _ from 'lodash';
import { TriggerEventManager } from '../trigger/services/trigger-event-manager/trigger-event-manager.service';
import { LoginUser } from '../auth/dto/login-user.dto';
import { ActivityFilterDto, ActivityListItemDto, GetBroadcastReportDto, GetReportDto } from './dto/get-report.dto';
import { ApiListResponseDto, PaginationMetaDto } from '@/common/dto/api-list-response.dto';
@Injectable()
export class ReportService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggerEventManager: TriggerEventManager,
    private readonly logger: PinoLogger,
  ) {
  }

  async getDashboard(user: LoginUser, filter: GetReportDto) {
    try {
      const start = new Date(filter.startDate);
      start.setHours(0, 0, 0, 0); // beginning of the day

      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999); // end of the day

      const baseWhere = {
        userId: BigInt(user.id),
        agencyId: BigInt(user.agencyId),
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      const totalSent = await this.prisma.conversation.count({
        where: {
          ...baseWhere,
          inOut: 'OUT',
        },
      });

      const totalReceived = await this.prisma.conversation.count({
        where: {
          ...baseWhere,
          inOut: 'IN',
        },
      });

      let responseRate = 0;
      if (totalReceived > 0) {
        responseRate = totalSent > 0
          ? parseFloat(((totalReceived / totalSent) * 100).toFixed(2))
          : 0;
      }

      const newContactsToday = await this.prisma.contact.count({
        where: {
          userId: user.parentUserId ?? user.id,
          agencyId: user.agencyId,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      });

      return {
        totalSent,
        totalReceived,
        responseRate,
        newContactsToday,
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch dashboard data');
    }
  }


  async getBroadcastReport(user: LoginUser, filter: GetBroadcastReportDto) {
    const { broadcastId, startDate, endDate } = filter;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const userId = user.parentUserId ?? user.id;

    const summary = await this.prisma.broadcastSummary.findUnique({
      where: { broadcastId },
      select: {
        totalContact: true,
        totalConnected: true,
        totalPaused: true,
        totalUnsubscribed: true,
      },
    });

    const totalContacts = summary?.totalContact ?? 0;
    const totalConnected = summary?.totalConnected ?? 0;
    const totalPaused = summary?.totalPaused ?? 0;
    const totalUnsubscribed = summary?.totalUnsubscribed ?? 0;

    const queues = await this.prisma.broadcastMessageQueue.findMany({
      where: {
        broadcastId,
        userId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    const totalSent = queues.filter(q => q.status === "SENT" || q.status === "DELIVERED").length;
    const totalQueue = queues.filter(q => q.status === "PENDING" || q.status === "PROCESSING").length;
    const totalFailed = queues.filter(q => q.status === "FAILED").length;

    const totalRead = await this.prisma.broadcastMessageLog.count({
      where: {
        broadcastId,
        userId,
        status: "READ",
        createdAt: { gte: start, lte: end },
      },
    });

    const totalReplied = await this.prisma.conversation.count({
      where: {
        broadcastId,
        userId,
        inOut: "IN",
        createdAt: { gte: start, lte: end },
      },
    });

    const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;
    const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    const dailyStats: Record<string, { sent: number; queue: number; failed: number }> = {};
    let current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().split("T")[0];
      dailyStats[key] = { sent: 0, queue: 0, failed: 0 };
      current.setDate(current.getDate() + 1);
    }

    queues.forEach(q => {
      const key = q.createdAt.toISOString().split("T")[0];
      if (!dailyStats[key]) dailyStats[key] = { sent: 0, queue: 0, failed: 0 };
      if (q.status === "SENT" || q.status === "DELIVERED") dailyStats[key].sent += 1;
      if (q.status === "PENDING" || q.status === "PROCESSING") dailyStats[key].queue += 1;
      if (q.status === "FAILED") dailyStats[key].failed += 1;
    });

    // Optional cost calculation
    const totalCostResult = await this.prisma.billingTransaction.aggregate({
      _sum: { creditAmount: true },
      where: {
        userId,
        broadcastId,
        createdAt: { gte: start, lte: end },
      },
    });

    const totalCost = totalCostResult._sum.creditAmount ?? 0;

    return {
      broadcastId,
      totalContacts,
      totalPaused,
      totalUnsubscribed,
      totalConnected,
      totalSent,
      totalQueue,
      totalFailed,
      totalRead,
      totalReplied,
      readRate: parseFloat(readRate.toFixed(2)),
      replyRate: parseFloat(replyRate.toFixed(2)),
      totalCost,
      dailyStats,
    };
  }

  async getActivities(
    user: LoginUser,
    query: ActivityFilterDto
  ): Promise<ApiListResponseDto<ActivityListItemDto>> {
    try {
      const {
        page = 1,
        perPage = 10,
        sortOn = 'created_at',
        sortDirection = 'desc',
        status,
        category,
        action,
        startDate,
        endDate,
        needPagination = true
      } = query ?? {}

      const safePerPage = Math.max(1, Math.min(100, Number(perPage)))
      const safePage = Math.max(1, Number(page))
      const offset = (safePage - 1) * safePerPage

      // allow-list sorting
      const allowedSortFields = new Set(['id', 'created_at'])
      const sortField = allowedSortFields.has(sortOn) ? sortOn : 'created_at'
      const sortDir = sortDirection.toLowerCase() === 'asc' ? 'asc' : 'desc'

      // Normalize start & end date to full-day range
      let normalizedStartDate: string | undefined
      let normalizedEndDate: string | undefined

      if (startDate) {
        const s = new Date(startDate)
        s.setHours(0, 0, 0, 0) // Start of the day
        normalizedStartDate = s.toISOString().slice(0, 19).replace('T', ' ')
      }

      if (endDate) {
        const e = new Date(endDate)
        e.setHours(23, 59, 59, 999) // End of the day
        normalizedEndDate = e.toISOString().slice(0, 19).replace('T', ' ')
      }

      // Build WHERE clause
      let whereClause = `activity.agency_id = ${user.agencyId} AND activity.user_id = ${user.id}`

      if (status) whereClause += ` AND activity.status = '${status}'`
      if (category) whereClause += ` AND activity.category = '${category}'`
      if (action) whereClause += ` AND activity.action = '${action}'`
      if (normalizedStartDate) whereClause += ` AND activity.created_at >= '${normalizedStartDate}'`
      if (normalizedEndDate) whereClause += ` AND activity.created_at <= '${normalizedEndDate}'`

      const baseQuery = `FROM activities activity WHERE ${whereClause}`

      // Total count
      const totalResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count ${baseQuery}`
      )
      const total = Number(totalResult[0]?.count ?? 0)

      // Fetch rows
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
      SELECT 
        id,
        user_id as userId,
        agency_id as agencyId,
        category,
        action,
        description,
        meta,
        contact_id as contactId,
        tag_id as tagId,
        segment_id as segmentId,
        trigger_id as triggerId,
        broadcast_id as broadcastId,
        message_template_id as messageTemplateId,
        custom_field_id as customFieldId,
        wa_business_number_id as waBusinessNumberId,
        wa_business_account_id as waBusinessAccountId,
        fb_business_account_id as fbBusinessAccountId,
        user_setting_id as userSettingId,
        personalization_id as personalizationId,
        created_at as createdAt
      ${baseQuery}
      ORDER BY activity.${sortField} ${sortDir}
      ${needPagination ? `LIMIT ${safePerPage} OFFSET ${offset}` : ''}
      `
      )

      // Map rows to DTO
      const data: ActivityListItemDto[] = rows.map((r) => ({
        id: Number(r.id),
        userId: Number(r.userId),
        agencyId: Number(r.agencyId),
        category: r.category,
        action: r.action,
        description: r.description,
        meta: r.meta,
        contactId: r.contactId ? Number(r.contactId) : null,
        tagId: r.tagId ? Number(r.tagId) : null,
        segmentId: r.segmentId ? Number(r.segmentId) : null,
        triggerId: r.triggerId ? Number(r.triggerId) : null,
        broadcastId: r.broadcastId ? Number(r.broadcastId) : null,
        messageTemplateId: r.messageTemplateId ? Number(r.messageTemplateId) : null,
        customFieldId: r.customFieldId ? Number(r.customFieldId) : null,
        waBusinessNumberId: r.waBusinessNumberId ? Number(r.waBusinessNumberId) : null,
        waBusinessAccountId: r.waBusinessAccountId ? Number(r.waBusinessAccountId) : null,
        fbBusinessAccountId: r.fbBusinessAccountId ? Number(r.fbBusinessAccountId) : null,
        userSettingId: r.userSettingId ? Number(r.userSettingId) : null,
        personalizationId: r.personalizationId ? Number(r.personalizationId) : null,
        createdAt: r.createdAt
      }))

      if (needPagination) {
        const totalPages = Math.max(1, Math.ceil(total / safePerPage))
        const pagination: PaginationMetaDto = {
          total,
          perPage: safePerPage,
          currentPage: safePage,
          totalPages,
          nextPage: safePage < totalPages ? safePage + 1 : undefined,
          prevPage: safePage > 1 ? safePage - 1 : undefined
        }
        return {
          statusCode: 200,
          message: 'Activities retrieved successfully.',
          data,
          pagination
        }
      }

      return {
        statusCode: 200,
        message: 'Activities retrieved successfully.',
        data
      }
    } catch (err) {
      console.error('err: ', err)
      return {
        statusCode: 500,
        message: 'An error occurred while fetching activities.',
        data: []
      }
    }
  }

}
