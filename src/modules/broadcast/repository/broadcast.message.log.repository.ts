import { Injectable } from '@nestjs/common'
import { BroadcastSettingStatus, BroadcastType } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from 'nestjs-prisma'
import { BroadcastSettingDTO } from '../dto/broadcast.setting.dto';
import type { BroadcastMessageLogDTO } from '../dto/broadcast.messagelog.dto';

@Injectable()
export class BroadcastMessageLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger
  ) { }

  /**
   * 
   * @param broadcastId 
   * @param contactId 
   */
  async findLastBroadcastSetting(broadcastId: bigint, contactId: bigint): Promise<BroadcastSettingDTO | null> {
    const result = await this.prisma.$queryRaw<
      {
        id: bigint;
        broadcast_type: string;
        day: number;
        priority: number;
        time: string;
        message_template_id: bigint,
        wa_business_number_id: bigint
      }[]>
      `SELECT bs.id, bs.broadcast_type, bs.day, bs.priority, bs.time, bs.message_template_id, bs.wa_business_number_id
         FROM broadcast_settings bs
         INNER JOIN broadcast_message_logs bsm ON bsm.broadcast_setting_id = bs.id
         WHERE bsm.broadcast_id = ${broadcastId} AND bsm.contact_id = ${contactId} AND bs.broadcast_type IN ('IMMEDIATE', 'SCHEDULE')
         ORDER BY bsm.id DESC
         LIMIT 1`;

    if (!result || result.length === 0) return null;

    const bs = result[0];
    return {
      id: bs.id,
      broadcastType: bs.broadcast_type as BroadcastType,
      day: bs.day,
      priority: bs.priority,
      time: bs.time,
      waBusinessNumberId: bs.wa_business_number_id,
      messageTemplateId: bs.message_template_id
    };
  }

  /**
   * 
   * @param broadcastId 
   * @param contactId 
   * @param broadcastSettingId 
   * @returns 
   */
  async hasMessageLogEntry(broadcastId: bigint, contactId: bigint, broadcastSettingId: bigint): Promise<boolean> {
    if (!broadcastId ||
      !contactId ||
      !broadcastSettingId) {
      return false;
    }

    try {
      const entry = await this.prisma.broadcastMessageLog.findFirst({
        where: {
          broadcastId: broadcastId,
          contactId: contactId,
          broadcastSettingId: broadcastSettingId,
        },
        select: { id: true },
      });
      return entry !== null;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  /**
   * @Milton463
   * @param dto 
   * @returns 
   */
  async addBroadcastMessageLog(dto: BroadcastMessageLogDTO) {
    try {
      console.log({ addBroadcastMessageLog: dto });
      return await this.prisma.broadcastMessageLog.create({
        data: {
          agencyId: dto.agencyId,
          userId: dto.userId,
          contactId: dto.contactId,
          broadcastId: dto.broadcastId,
          broadcastSettingId: dto.broadcastSettingId,
          waBusinessAccountId: dto.waBusinessAccountId,
          fbBusinessId: dto.fbBusinessId,
          waBusinessNumberId: dto.waBusinessNumberId,
          message: dto.message,
          messagingProduct: dto.messagingProduct as any,
          messageType: dto.messageType as any,
          response: dto.response,
          errorMessage: dto.errorMessage,
          status: dto.status as any,
          lastMessageAt: dto.lastMessageAt ?? new Date(),
          messageSid: dto.messageSid,
          accountSid: dto.accountSid
        }
      })
    } catch (error) {
      this.logger.error(error);
    }
  }

  async findLastSentRecurringSetting(broadcastId: bigint, contactId: bigint, broadcastSettingId: bigint) {
    if (!broadcastId ||
      !contactId ||
      !broadcastSettingId) {
      return false;
    }

    try {
      const entry = await this.prisma.broadcastMessageLog.findFirst({
        where: {
          broadcastId: broadcastId,
          contactId: contactId,
          broadcastSettingId: broadcastSettingId,
        },
        orderBy:{
          id:"desc"
        }

      });
      return entry;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

} 
