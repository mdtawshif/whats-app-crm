import { Injectable } from '@nestjs/common'
import { tryCatch } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { BroadcastSettingStatsCreateDto } from '../dto/broadcast.dto';

@Injectable()
export class BroadcastSettingStatsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(BroadcastSettingStatsRepository.name)
  }

  /**
   * @Milton463
   * @param broadcastId
   * @param broadcastSettingId
   * @returns
   */
  async findBroadcastSettingStatsId(
    broadcastId: bigint,
    broadcastSettingId: bigint
  ) {
    if (broadcastId === null || broadcastSettingId === null) {
      return null
    }
    try {
      const statsId = await this.prisma.broadcastSettingsStats.findFirst({
        where: {
          broadcastId: broadcastId,
          broadcastSettingId: broadcastSettingId
        },
        select: {
          id: true
        }
      })
      return statsId ? statsId.id : null
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * @Milton463
   * @param dto
   * @returns
   */
  async addBroadcastSettingStats(dto: BroadcastSettingStatsCreateDto) {
    try {
      return await this.prisma.broadcastSettingsStats.create({
        data: {
          agencyId: dto.agencyId,
          userId: dto.userId,
          broadcastId: dto.broadcastId,
          broadcastSettingId: dto.broadcastSettingId,
          totalSent: dto.totalSent,
          totalFailed: dto.totalFailed,
          totalRead: dto.totalRead,
          totalDelivered: dto.totalDelivered,
          totalUndelivered: dto.totalUndelivered,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
     * @Milton463
     * @param id 
     * @param field 
     * @param incrementBy 
     * @returns 
     */
    async incrementBroadcastStat(id: bigint, field: string, incrementBy: number): Promise<boolean> {
        
        if (!id || !field) {
            this.logger.warn('Missing parameters in incrementBroadcastStatsRaw');
            return false;
        }

        const allowedFields = ['total_sent', 'total_failed', 'total_read', 'total_delivered', 'total_undelivered'];
        if (!allowedFields.includes(field)) {
            return false;
        }

        const incrementQuery = `UPDATE broadcast_settings_stats
            SET ${field} = ${field} + ${incrementBy}, updated_at = NOW()
            WHERE id = ${id}`;

        try {
            const totalRowUpdated = await this.prisma.$executeRawUnsafe(incrementQuery);
            return totalRowUpdated > 0;
        } catch (error) {
            this.logger.error(`Failed to increment ${field} for broadcast_setting_stats ${id}:`);
        }
        return false;
    }


    /**
     * @Milton463
     * @param statsId 
     * @param increments 
     * @returns 
     */
    async incrementBroadcastStats(statsId: bigint, increments: Record<string, number>): Promise<boolean> {
        try {
            if (!statsId || !increments || Object.keys(increments).length === 0) {
                return false;
            }

            // Build dynamic SET clause
            const setClauses = Object.entries(increments)
            .map(([field, value]) => `${field} = ${field} + ${value}`).join(', ');

            const query = `UPDATE broadcast_settings_stats
                SET ${setClauses}, updated_at = NOW()
                WHERE id = ${statsId};`;

            const result = await this.prisma.$executeRawUnsafe(query);
            return result > 0;
        } catch (error) {
            this.logger.error('Error incrementing stats dynamically:', error);
            return false;
        }
    }

}
