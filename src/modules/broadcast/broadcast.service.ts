import { ForbiddenException, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from "nestjs-prisma";
import { CreateBroadcastDto } from "./dto/create-broadcast.dto";
import { UpdateBroadcastDto } from "./dto/edit-broadcast.dto";
import { LoginUser } from "../auth/dto/login-user.dto";
import { BroadCastListParamDto, BroadcastListItemDto } from './dto/list-broadcast.dto';
import { ApiListResponseDto, PaginationMetaDto } from '../../common/dto/api-list-response.dto';
import { ApiDeleteResponseDto } from '../../common/dto/api-delete-response.dto';
import { ApiUpdateResponseDto } from '../../common/dto/api-update-response.dto';
import { ApiCreateResponseDto } from '../../common/dto/api-create-response.dto';
import { BroadcastSettingStatus, BroadcastStatus, BroadcastType, ContactAction, ContactPauseResumeRequestStatus, LimitType, PauseStopOption, Prisma, BroadcastContactQueueSource, EntryStatus, BroadcastPauseResumeRequestStatus, PauseResumeAction, Broadcast, BroadcastSummary, QueueStatus, BroadcastLogStatus, ActivityAction, ActivityCategory } from '@prisma/client';
import { ApiViewResponseDto } from '../../common/dto/api-view-response.dto';
import { BroadcastResponseDto, UnsubscribeContactsDto, AddBroadcastContactsDto, BroadcastContactListItemDto, BroadcastContactListParamDto, ChangeBroadcastBodyDto, PauseResumeContactsDto, BroadcastStatsResponseDTO } from './dto/broadcast.dto';
import { PinoLogger } from 'nestjs-pino';
import { CreateSequenceDto, BroadcastSequenceResponseDto, UpdateSequenceDto } from './dto/create-sequence.dto';
import { BroadcastSettingsPriorityService } from './service/broadcast-settings-priority.service';
import { BroadcastSettingDetailResponse, BroadcastSettingDetailStatus, BroadcastSettingStatsDTO } from './dto/broadcast.sequence.stats.dto';
import { of } from 'rxjs';
import { tryCatch } from 'bullmq';
import { createActivity } from '@/common/helpers/activity-log.helper';

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastSettingsPriorityService: BroadcastSettingsPriorityService,
    private readonly logger: PinoLogger
  ) { }

  async createBroadcast(
    user: LoginUser,
    dto: CreateBroadcastDto
  ): Promise<ApiCreateResponseDto<BroadcastResponseDto>> {
    // Same regex/helper as above (or import them)
    const HHMM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/
    const hhmmToUtcDateLoose = (s?: string) =>
      s && HHMM_REGEX.test(s)
        ? new Date(Date.UTC(1970, 0, 1, ...s.split(':').map(Number), 0))
        : undefined

    const startTimeDate = dto.startTimeDate ?? hhmmToUtcDateLoose(dto.startTime)
    const endTimeDate = dto.endTimeDate ?? hhmmToUtcDateLoose(dto.endTime)

    // Ensure class-transformer populated these from "HH:mm"
    if (!startTimeDate || !endTimeDate) {
      throw new BadRequestException(
        'Invalid or missing time. Expect HH:mm (e.g., "09:00").'
      )
    }

    // helper: Date (TIME-only) -> "HH:mm"
    const toHHMM = (d?: Date | null) =>
      d
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : undefined

    const now = new Date()
    const fromDate = new Date(dto.fromDate);
    fromDate.setHours(0, 0, 0);
    const toDate = new Date(dto.toDate);
    toDate.setHours(23, 59, 59);

    const broadcast = await this.prisma.broadcast.create({
      data: {
        agencyId: user.agencyId,
        wabaId: dto.wabaId.trim(),
        userId: user.parentUserId || user.id,
        createdBy: user.id,
        title: dto.title.trim(),
        status: BroadcastStatus.ACTIVE,
        fromDate: fromDate,
        toDate: toDate,
        selectedDays: dto.selectedDays as unknown as Prisma.InputJsonValue, // JSON array
        startTime: startTimeDate, // DateTime(@db.Time)
        endTime: endTimeDate, // DateTime(@db.Time)
        createdAt: now,
        updatedAt: now
      }
    })

    await createActivity({
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      createdBy: user.id,
      action: ActivityAction.CREATE,
      category: ActivityCategory.BROADCAST,
      description: `Broadcast "${broadcast.title.trim()}" was created by ${user.userName ?? 'Unknown User'} on ${new Date().toLocaleString()}.`,
      broadcastId: broadcast.id
    })

    await this.prisma.broadcastSummary.create({
      data: {
        broadcastId: broadcast.id,
        totalContact: 0,
        totalConnected: 0,
        totalPaused: 0,
        totalUnsubscribed: 0,
        createdAt: now,
        updatedAt: now
      }
    })

    const data: BroadcastResponseDto = {
      id: Number(broadcast.id),
      agencyId: Number(broadcast.agencyId),
      userId: Number(broadcast.userId),
      title: broadcast.title,
      status: broadcast.status,
      wabaId: broadcast.wabaId,

      createdAt: broadcast.createdAt ?? undefined,
      updatedAt: broadcast.updatedAt ?? undefined,
      startedAt: broadcast.startedAt ?? undefined,
      pausedAt: broadcast.pausedAt ?? undefined,
      errorMessage: broadcast.errorMessage ?? undefined,
      totalContacted: broadcast.totalContacted,
      rescheduleDueToRateLimit: broadcast.rescheduleDueToRateLimit,

      fromDate: broadcast.fromDate,
      toDate: broadcast.toDate,
      selectedDays: (broadcast.selectedDays as any) ?? [],
      startTime: dto.startTime!,
      endTime: dto.endTime!
    }

    return {
      statusCode: 201,
      message: 'Broadcast created successfully.',
      data: data
    }
  }

  async getBroadcasts(
    user: LoginUser,
    query: BroadCastListParamDto
  ): Promise<ApiListResponseDto<BroadcastListItemDto>> {
    const {
      page = 1,
      perPage = 10,
      sortOn,
      sortDirection,
      needPagination = true,
      query: searchQuery // 👈 search term
    } = query

    const where: any = { agencyId: user.agencyId, userId: user.parentUserId || user.id }

    // Case-insensitive search: convert to lowercase
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      where.OR = [
        { title: { contains: lowerQuery } }, // contains anywhere
        { title: { startsWith: lowerQuery } }, // starts with
        { title: { endsWith: lowerQuery } } // ends with
      ]
    }

    const orderBy: any = sortOn
      ? { [sortOn]: sortDirection || 'desc' }
      : { createdAt: 'desc' }

    let broadcasts: (Broadcast & { broadcastSummaries: BroadcastSummary[] })[] = [];
    let total = 0

    if (needPagination) {
      [broadcasts, total] = await this.prisma.$transaction([
        this.prisma.broadcast.findMany({
          where,
          orderBy,
          skip: (page - 1) * perPage,
          take: perPage,
          include: { broadcastSummaries: true }
        }),
        this.prisma.broadcast.count({ where })
      ])
    } else {
      broadcasts = await this.prisma.broadcast.findMany({
        where,
        orderBy,
        include: { broadcastSummaries: true }
      })
      total = broadcasts.length
    }

    const broadcastDtos: BroadcastListItemDto[] = broadcasts.map((b) => {
      const summary = b.broadcastSummaries?.[0];
      return {
        id: b.id,
        title: b.title || '',
        agencyId: b.agencyId,
        createdBy: b.createdBy,
        userId: b.userId,
        status: b.status,
        wabaId: b.wabaId!,
        createdAt: b.createdAt || undefined,
        startedAt: b.startedAt || undefined,
        pausedAt: b.pausedAt || undefined,
        errorMessage: b.errorMessage || undefined,
        totalContacted: b.totalContacted,
        rescheduleDueToRateLimit: b.rescheduleDueToRateLimit,
        totalContact: summary?.totalContact || 0,
        totalConnacted: summary?.totalConnected || 0,
        totalPaused: summary?.totalPaused || 0,
        totalUnsubscribed: summary?.totalUnsubscribed || 0
      };
    });


    const response: ApiListResponseDto<BroadcastListItemDto> = {
      statusCode: 200,
      message: 'Broadcasts fetched successfully.',
      data: broadcastDtos
    }

    if (needPagination) {
      response.pagination = {
        total,
        perPage,
        currentPage: page,
        totalPages: Math.ceil(total / perPage),
        nextPage: page * perPage < total ? page + 1 : undefined,
        prevPage: page > 1 ? page - 1 : undefined
      }
    }

    return response
  }

  async getBroadcastById(user: LoginUser, id: number) {

    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id }
    });

    return broadcast;
  }

  async updateBroadcast(
    user: LoginUser,
    dto: UpdateBroadcastDto
  ): Promise<ApiUpdateResponseDto<BroadcastResponseDto>> {
    // helper: Date (TIME) -> "HH:mm"
    const toHHMM = (d?: Date | null) =>
      d
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : undefined

    // 1) Permission check (and ensure the record exists)
    const existing = await this.prisma.broadcast.findFirst({
      where: { id: dto.id, userId: user.id, agencyId: user.agencyId }
    })
    if (!existing) {
      throw new NotFoundException(
        `Broadcast with id ${dto.id} not found or no permission`
      )
    }

    // 2) Build update payload (only provided fields)
    const data: Prisma.BroadcastUpdateInput = {}
    if (dto.title !== undefined) data.title = dto.title.trim()
    if (dto.status !== undefined) data.status = dto.status

    if (dto.fromDate !== undefined) data.fromDate = new Date(dto.fromDate)
    if (dto.toDate !== undefined) data.toDate = new Date(dto.toDate)
    if (dto.selectedDays !== undefined) {
      data.selectedDays = dto.selectedDays as unknown as Prisma.InputJsonValue
    }

    /*
    if (dto.startTimeDate !== undefined) {
      if (
        !(dto.startTimeDate instanceof Date) ||
        isNaN(dto.startTimeDate.getTime())
      ) {
        throw new BadRequestException('Invalid startTime; expected HH:mm.')
      }
      data.startTime = dto.startTimeDate // Date -> DateTime(@db.Time)
    }

    if (dto.endTimeDate !== undefined) {
      if (
        !(dto.endTimeDate instanceof Date) ||
        isNaN(dto.endTimeDate.getTime())
      ) {
        throw new BadRequestException('Invalid endTime; expected HH:mm.')
      }
      data.endTime = dto.endTimeDate
    }
*/

    // Handle startTime (string in HH:mm format)
    if (dto.startTime !== undefined) {
      const [hours, minutes] = dto.startTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new BadRequestException('Invalid startTime; expected HH:mm.');
      }
      // Create a Date object with a dummy date, or store as string if DB expects time
      const startTimeDate = new Date();
      startTimeDate.setHours(hours, minutes, 0, 0);
      data.startTime = startTimeDate; // Adjust based on DB field type
    }

    // Handle endTime (string in HH:mm format)
    if (dto.endTime !== undefined) {
      const [hours, minutes] = dto.endTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new BadRequestException('Invalid endTime; expected HH:mm.');
      }
      // Create a Date object with a dummy date, or store as string if DB expects time
      const endTimeDate = new Date();
      endTimeDate.setHours(hours, minutes, 0, 0);
      data.endTime = endTimeDate; // Adjust based on DB field type
    }

    data.updatedAt = new Date()

    // 3) Update by unique id (we already checked ownership)
    const broadcast = await this.prisma.broadcast.update({
      where: { id: dto.id },
      data
    })

    await createActivity({
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      createdBy: user.id,
      category: ActivityCategory.BROADCAST,
      action: ActivityAction.UPDATE,
      description: `Broadcast ${broadcast.id} updated by ${user.userName} at ${new Date().toLocaleString()}.`,
      broadcastId: broadcast.id
    })

    // 4) Map to UpdateBroadcastDto shape for the response

    const responseData: BroadcastResponseDto = {
      id: Number(broadcast.id),
      agencyId: Number(broadcast.agencyId),
      userId: Number(broadcast.userId),
      title: broadcast.title,
      status: broadcast.status,
      wabaId: broadcast.wabaId,
      createdAt: broadcast.createdAt ?? undefined,
      updatedAt: broadcast.updatedAt ?? undefined,
      startedAt: broadcast.startedAt ?? undefined,
      pausedAt: broadcast.pausedAt ?? undefined,
      errorMessage: broadcast.errorMessage ?? undefined,
      totalContacted: broadcast.totalContacted,
      rescheduleDueToRateLimit: broadcast.rescheduleDueToRateLimit,

      fromDate: broadcast.fromDate,
      toDate: broadcast.toDate,
      selectedDays: (broadcast.selectedDays as any) ?? [],
      startTime: toHHMM(broadcast.startTime)!,
      endTime: toHHMM(broadcast.endTime)!
    }

    return {
      statusCode: 200,
      message: 'Broadcast updated successfully.',
      data: responseData
    }
  }

  async deleteBroadcast(
    user: LoginUser,
    id: number
  ): Promise<ApiDeleteResponseDto> {

    const existing = await this.prisma.broadcast.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        statusCode: 404,
        message: `Broadcast with ID ${id} not found.`,
        deletedId: null,
      };
    }

    const broadcast = await this.prisma.broadcast.delete({
      where: { id: id }
    });

    await createActivity({
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      createdBy: user.id,
      category: ActivityCategory.BROADCAST,
      action: ActivityAction.DELETE,
      description: `Broadcast ${id} deleted by ${user.userName} at ${new Date().toLocaleString()}.`,
    })

    return {
      statusCode: 200,
      message: 'Broadcast deleted successfully.',
      deletedId: id // Optional: return deleted entity ID if needed
    }
  }

  async getBroadcast(
    user: LoginUser,
    id: number
  ): Promise<ApiViewResponseDto<BroadcastResponseDto>> {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { agencyId: user.agencyId, userId: user.id, id: id }
    })

    if (!broadcast) throw new Error('Broadcast not found')

    // helper: Date (TIME) -> "HH:mm"
    const toHHMM = (d?: Date | null) =>
      d
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : undefined

    // 4) Map to UpdateBroadcastDto shape for the response
    const responseData: BroadcastResponseDto = {
      id: Number(broadcast.id),
      agencyId: Number(broadcast.agencyId),
      userId: Number(broadcast.userId),
      title: broadcast.title,
      status: broadcast.status,
      wabaId: broadcast.wabaId,
      createdAt: broadcast.createdAt ?? undefined,
      updatedAt: broadcast.updatedAt ?? undefined,
      startedAt: broadcast.startedAt ?? undefined,
      pausedAt: broadcast.pausedAt ?? undefined,
      errorMessage: broadcast.errorMessage ?? undefined,
      totalContacted: broadcast.totalContacted,
      rescheduleDueToRateLimit: broadcast.rescheduleDueToRateLimit,

      fromDate: broadcast.fromDate,
      toDate: broadcast.toDate,
      selectedDays: (broadcast.selectedDays as any) ?? [],
      startTime: toHHMM(broadcast.startTime)!,
      endTime: toHHMM(broadcast.endTime)!
    }

    return {
      statusCode: 200,
      message: 'Broadcast retrieved successfully.',
      data: responseData
    }
  }

  /**
   * @Update
   * @param id
   * @param data
   * @returns
   */
  async update(id: bigint, data: any): Promise<boolean> {
    console.log('data: {}', data)
    try {
      const updatedBroadcast = await this.prisma.broadcast.update({
        where: {
          id: id
        },
        data: {
          ...data,
          updatedAt: new Date()
        }
      })
      return !!updatedBroadcast
    } catch (error) {
      this.logger.error(error)
    }

    return false
  }

  async createSequence(
    user: LoginUser,
    dto: CreateSequenceDto,
    broadcastId: number
  ): Promise<ApiCreateResponseDto<BroadcastSequenceResponseDto>> {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId }
    })

    if (!broadcast) throw new Error('Broadcast not found')

    const { timeConfig, templateId } = dto

    // ⬇️ pick defaults that exist in your enums
    const DEFAULT_STATUS: BroadcastSettingStatus = BroadcastSettingStatus.ACTIVE
    const DEFAULT_LIMIT_TYPE: LimitType = LimitType.PER_MINUTE // <- change if your enum differs
    const DEFAULT_PAUSE_BEHAVIOR: PauseStopOption = PauseStopOption.NO // <- change if your enum differs

    // Compute scheduling fields for BroadcastSetting
    let time: Date
    let day: number = 0

    // "HH:mm" -> Date @ 1970-01-01 UTC to satisfy @db.Time
    const toTimeDate = (hhmm: string): Date => {
      const m = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(hhmm)
      if (!m)
        throw new BadRequestException('startTime must be HH:mm (00:00–23:59)')
      const [h, min] = hhmm.split(':').map(Number)
      return new Date(Date.UTC(1970, 0, 1, h, min, 0))
    }
    // current time-of-day as TIME
    const nowTimeDate = (): Date => {
      const now = new Date()
      return new Date(
        Date.UTC(1970, 0, 1, now.getUTCHours(), now.getUTCMinutes(), 0)
      )
    }

    switch (timeConfig.type) {
      case BroadcastType.IMMEDIATE:
        time = nowTimeDate()
        break

      case BroadcastType.SCHEDULE:
        if (timeConfig.days == null || !timeConfig.startTime) {
          throw new BadRequestException(
            'For SCHEDULE, both "days" (>=0) and "startTime" (HH:mm) are required.'
          )
        }
        day = timeConfig.days
        time = toTimeDate(timeConfig.startTime)
        break

      case BroadcastType.RECURRING:
        if (
          timeConfig.days == null ||
          timeConfig.days < 1 ||
          !timeConfig.startTime
        ) {
          throw new BadRequestException(
            'For RECURRING, both "days" (>=1) and "startTime" (HH:mm) are required.'
          )
        }
        day = timeConfig.days // interpreted as repeat interval (every N days)
        time = toTimeDate(timeConfig.startTime)
        break

      default:
        throw new BadRequestException('Unsupported timeConfig.type')
    }

    // 2) Resolve waBusinessNumberId from numberSelection
    const firstSel = dto.numberSelection?.phoneNumbers?.[0]
    if (firstSel == null) {
      throw new BadRequestException(
        'At least one phone number is required in numberSelection.phoneNumbers'
      )
    }

    // Try to resolve by phoneNumberId (string) or by id (BigInt)
    const tryFindById = async (val: string | number) => {
      try {
        const idBig = BigInt(String(val))
        return await this.prisma.waBusinessNumber.findUnique({
          where: { id: idBig }
        })
      } catch {
        return null
      }
    }

    let waNumber = await tryFindById(firstSel)

    if (!waNumber) {
      throw new BadRequestException('Selected WhatsApp number not found')
    }

    // 1) Provisional priority = current max + 1 (avoids unique clash)
    const agg = await this.prisma.broadcastSetting.aggregate({
      where: { broadcastId: BigInt(broadcastId) },
      _max: { priority: true }
    })
    const provisionalPriority = (agg._max.priority ?? -1) + 1

    // Create the BroadcastSetting row
    const setting = await this.prisma.broadcastSetting.create({
      data: {
        // required FKs
        userId: user.parentUserId || user.id, // BigInt
        createdBy: user.id, // BigInt
        agencyId: user.agencyId,
        broadcastId: broadcastId,

        // template
        messageTemplateId: templateId, // BigInt in schema; Prisma accepts number here
        waBusinessNumberId: waNumber.id, // link to selected WA number
        messageBody: dto.messageBody,

        // scheduling
        broadcast_type: timeConfig.type, // Prisma enum BroadcastType
        day, // null for IMMEDIATE; N days for SCHEDULE/RECURRING
        time, // TIME-only stored as Date
        priority: provisionalPriority, // default to 0 if omitted

        // required enums / operational defaults
        status: DEFAULT_STATUS,
        limitType: DEFAULT_LIMIT_TYPE,
        pauseOnError: DEFAULT_PAUSE_BEHAVIOR,
        stopOnLimitExceeded: DEFAULT_PAUSE_BEHAVIOR

        // optional fields left null: messageBody, rateLimitEnabled, limitValue
        // retryCount / retryDelaySeconds have defaults in schema
      }
    })

    if (setting) {
      await this.createBroadcastSettingStats(user, broadcastId, setting.id);
    }

    // helper: Date (TIME-only) -> "HH:mm"
    const toHHMM = (d?: Date | null) =>
      d
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : '00:00'

    // Shape a response (adjust to your BroadcastSequenceResponseDto)
    const response: BroadcastSequenceResponseDto = {
      id: Number(setting.id),
      broadcastId: Number(setting.broadcastId),
      messageTemplateId: setting.messageTemplateId
        ? Number(setting.messageTemplateId)
        : undefined,
      type: setting.broadcast_type,
      day: setting.day ?? undefined,
      priority: setting.priority ?? undefined,
      time: toHHMM(setting.time), // convert TIME(Date) -> "HH:mm"
      status: setting.status,
      messageBody: setting.messageBody,

      // optional operational fields
      limitType: setting.limitType ?? undefined,
      limitValue: setting.limitValue ?? undefined,
      retryCount: setting.retryCount,
      retryDelaySeconds: setting.retryDelaySeconds,
      pauseOnError: setting.pauseOnError,
      stopOnLimitExceeded: setting.stopOnLimitExceeded
    }

    this.broadcastSettingsPriorityService.recalcPriorities(broadcastId)

    return {
      statusCode: 200,
      message: 'Broadcast sequence created successfully.',
      data: response
    }
  }

  private async createBroadcastSettingStats(user: LoginUser, broadcastId: number, broadcastSettingId: bigint) {
    try {
      const broadcastSettingStat = await this.prisma.broadcastSettingsStats.create({
        data: {
          userId: user.parentUserId || user.id,
          agencyId: user.agencyId,
          broadcastId: broadcastId,
          broadcastSettingId: broadcastSettingId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

    } catch (error) {
      this.logger.error(error);
    }

  }

  async updateSequence(
    user: LoginUser,
    broadcastId: number,
    sequenceId: number,
    dto: UpdateSequenceDto
  ): Promise<ApiUpdateResponseDto<BroadcastSequenceResponseDto>> {
    if (!sequenceId) {
      throw new BadRequestException('Sequence id is required')
    }

    // Helpers
    const toHHMM = (d?: Date | null) =>
      d
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : '00:00'

    const toTimeDate = (hhmm: string): Date => {
      const m = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(hhmm)
      if (!m)
        throw new BadRequestException('startTime must be HH:mm (00:00–23:59)')
      const [h, min] = hhmm.split(':').map(Number)
      return new Date(Date.UTC(1970, 0, 1, h, min, 0))
    }

    const nowTimeDate = (): Date => {
      const now = new Date()
      return new Date(
        Date.UTC(1970, 0, 1, now.getUTCHours(), now.getUTCMinutes(), 0)
      )
    }

    // 1) Ensure broadcast exists (optionally scope by tenant)
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId }
    })
    if (!broadcast) throw new NotFoundException('Broadcast not found')

    // 2) Load existing setting (for fallbacks)
    const existing = await this.prisma.broadcastSetting.findFirst({
      where: {
        id: sequenceId,
        broadcastId
      }
    })
    if (!existing) throw new NotFoundException('Sequence not found')

    // 3) Build update payload (only set provided fields)
    const data: Prisma.BroadcastSettingUncheckedUpdateManyInput = {
      updatedAt: new Date()
    }

    // templateId
    if (dto.templateId !== undefined) {
      data.messageTemplateId = dto.templateId
    }

    // priority
    if (dto.priority !== undefined) {
      data.priority = dto.priority
    }

    // priority
    if (dto.messageBody !== undefined) {
      data.messageBody = dto.messageBody
    }

    // number selection → waBusinessNumberId
    if (dto.numberSelection?.phoneNumbers?.length) {
      const firstSel = dto.numberSelection.phoneNumbers[0]
      // Treat it as WaBusinessNumber.id (BigInt)
      let waNumber = null
      try {
        const idBig = BigInt(String(firstSel))
        waNumber = await this.prisma.waBusinessNumber.findUnique({
          where: { id: idBig }
        })
      } catch {
        waNumber = null
      }
      if (!waNumber) {
        throw new BadRequestException('Selected WhatsApp number not found')
      }
      ; (data as any).waBusinessNumberId = waNumber.id // unchecked assign due to type gaps in UpdateMany
    }

    // timeConfig → broadcast_type, day, time
    if (dto.timeConfig) {
      const cfg = dto.timeConfig

      switch (cfg.type) {
        case BroadcastType.IMMEDIATE:
          ; (data as any).broadcast_type = BroadcastType.IMMEDIATE
            ; (data as any).day = 0
            ; (data as any).time = nowTimeDate()
          break

        case BroadcastType.SCHEDULE:
          if (cfg.days == null || cfg.days < 0 || !cfg.startTime) {
            throw new BadRequestException(
              'For SCHEDULE, "days" (>=0) and "startTime" are required.'
            )
          }
          ; (data as any).broadcast_type = BroadcastType.SCHEDULE
            ; (data as any).day = cfg.days
            ; (data as any).time = toTimeDate(cfg.startTime)
          break

        case BroadcastType.RECURRING:
          if (cfg.days == null || cfg.days < 1 || !cfg.startTime) {
            throw new BadRequestException(
              'For RECURRING, "days" (>=1) and "startTime" are required.'
            )
          }
          ; (data as any).broadcast_type = BroadcastType.RECURRING
            ; (data as any).day = cfg.days
            ; (data as any).time = toTimeDate(cfg.startTime)
          break

        default:
          throw new BadRequestException('Unsupported timeConfig.type')
      }
    }

    // 4) Apply update
    const updatedRes = await this.prisma.broadcastSetting.updateMany({
      where: {
        id: sequenceId,
        broadcastId
      },
      data
    })

    if (updatedRes.count === 0) {
      throw new NotFoundException('Sequence not found or not updated')
    }

    // 5) Reload with relations for response
    const setting = await this.prisma.broadcastSetting.findUnique({
      where: { id: BigInt(sequenceId) },
      include: {
        messageTemplate: { select: { name: true } },
        waBusinessNumber: {
          select: { id: true, displayPhoneNumber: true, number: true }
        }
      }
    })
    if (!setting) {
      throw new NotFoundException('Sequence not found after update')
    }

    // 6) Shape DTO
    const response: BroadcastSequenceResponseDto = {
      id: Number(setting.id),
      broadcastId: Number(setting.broadcastId),
      messageTemplateId: setting.messageTemplateId
        ? Number(setting.messageTemplateId)
        : undefined,
      type: setting.broadcast_type,
      day: setting.day ?? undefined,
      priority: setting.priority ?? undefined,
      time: toHHMM(setting.time),
      status: setting.status,
      messageBody: setting.messageBody,

      limitType: setting.limitType ?? undefined,
      limitValue: setting.limitValue ?? undefined,
      retryCount: setting.retryCount,
      retryDelaySeconds: setting.retryDelaySeconds,
      pauseOnError: setting.pauseOnError,
      stopOnLimitExceeded: setting.stopOnLimitExceeded,

      // enriched
      templateName: setting.messageTemplate?.name,
      numberDisplayName:
        setting.waBusinessNumber?.displayPhoneNumber ?? undefined,
      number: setting.waBusinessNumber?.number ?? undefined,
      numberId: setting.waBusinessNumber
        ? Number(setting.waBusinessNumber.id)
        : undefined
    }

    this.broadcastSettingsPriorityService.recalcPriorities(broadcastId)

    return {
      statusCode: 200,
      message: 'Broadcast sequence updated successfully.',
      data: response
    }
  }

  async getSequences(
    user: LoginUser,
    broadcastId: number
  ): Promise<ApiListResponseDto<BroadcastSequenceResponseDto>> {
    // Fetch sequences for this broadcast (optionally scope by agency/team)
    const rows = await this.prisma.broadcastSetting.findMany({
      where: {
        broadcastId: broadcastId,
        status: { not: BroadcastSettingStatus.DELETED }
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        messageTemplate: { select: { name: true } },
        waBusinessNumber: {
          select: { id: true, displayPhoneNumber: true, number: true }
        }
      }
    })

    // helper: Date (TIME-only) -> "HH:mm"
    const toHHMM = (d?: Date | null) =>
      d
        ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : '00:00'

    console.log('rows: {}', rows)

    const data: BroadcastSequenceResponseDto[] = rows.map((s) => ({
      id: Number(s.id),
      broadcastId: Number(s.broadcastId),
      messageTemplateId: s.messageTemplateId
        ? Number(s.messageTemplateId)
        : undefined,
      type: s.broadcast_type, // Prisma: broadcast_type -> DTO: type
      day: s.day ?? undefined,
      priority: s.priority ?? undefined,
      time: toHHMM(s.time), // TIME(Date) -> "HH:mm"
      status: s.status,
      messageBody: s.messageBody,

      // optional operational fields
      limitType: s.limitType ?? undefined,
      limitValue: s.limitValue ?? undefined,
      retryCount: s.retryCount,
      retryDelaySeconds: s.retryDelaySeconds,
      pauseOnError: s.pauseOnError,
      stopOnLimitExceeded: s.stopOnLimitExceeded,

      // enriched fields
      templateName: s.messageTemplate?.name,
      numberDisplayName: s.waBusinessNumber?.displayPhoneNumber ?? undefined,
      number: s.waBusinessNumber?.number ?? undefined,
      numberId: s.waBusinessNumber ? Number(s.waBusinessNumber.id) : undefined
    }))

    console.log('data: {}', data)

    return {
      statusCode: 200,
      message: 'Sequences retrieved successfully.',
      data
    }
  }

  async deleteSequence(
    user: LoginUser,
    broadcastId: number,
    sequenceId: number
  ): Promise<ApiDeleteResponseDto> {
    if (!broadcastId || !sequenceId) {
      throw new BadRequestException('broadcastId and sequenceId are required')
    }

    const result = await this.prisma.broadcastSetting.updateMany({
      where: {
        id: sequenceId,
        broadcastId,
        status: { not: BroadcastSettingStatus.DELETED }
      },
      data: {
        status: BroadcastSettingStatus.DELETED,
        updatedAt: new Date()
      }
    })

    if (result.count === 0) {
      throw new NotFoundException('Sequence not found or already deleted')
    }

    this.broadcastSettingsPriorityService.recalcPriorities(broadcastId)

    return {
      statusCode: 200,
      message: 'Sequence deleted successfully.'
    }
  }

  async unsubscribeContacts(
    user: LoginUser,
    dto: UnsubscribeContactsDto,
    broadcastId: number
  ): Promise<ApiUpdateResponseDto<UnsubscribeContactsDto>> {
    console.log('dto: {}', dto)
    console.log('broadcastId: {}', broadcastId)

    if (
      !broadcastId ||
      !Array.isArray(dto.contactIds) ||
      dto.contactIds.length === 0
    ) {
      throw new BadRequestException(
        'broadcastId and a non-empty contactIds[] are required'
      )
    }

    const now = new Date()

    let successCount = 0
    const failed: Array<{ contactId: number; error: string }> = []

    for (const contactId of dto.contactIds) {
      try {
        const row = await this.prisma.contactPauseResumeRequest.create({
          data: {
            agencyId: user.agencyId!,
            userId: user.parentUserId || user.id!,
            createdBy: user.id!,
            broadcastId: broadcastId!, // model is BigInt?; DTO requires it
            contactId: contactId!,

            action: ContactAction.UNSUBSCRIBE, // or PAUSE depending on semantics
            status: ContactPauseResumeRequestStatus.PENDING,

            failedReason: '', // required non-null column
            requestedAt: now,
            processedAt: null
          }
        })

        await createActivity({
          userId: user.parentUserId ?? user.id,
          agencyId: user.agencyId,
          createdBy: user.id,
          category: ActivityCategory.BROADCAST,
          action: ActivityAction.UNSUBSCRIBE,
          description: `Contact ${contactId} unsubscribed from broadcast ${broadcastId} by ${user.userName} at ${new Date().toLocaleString()}.`,
          contactId: BigInt(row.contactId),
          broadcastId: BigInt(row.broadcastId)
        })

        // optional log
        // this.logger?.debug?.(`Queued unsubscribe request id=${row.id} for contactId=${contactId}`);
        successCount++
      } catch (e: any) {
        // continue with others
        failed.push({
          contactId: Number(contactId),
          error: e?.message ?? String(e)
        })
      }
    }

    if (failed.length === dto.contactIds.length) {
      // all failed
      throw new InternalServerErrorException(
        'Failed to queue unsubscribe requests for all contacts.'
      )
    }

    const msg =
      failed.length > 0
        ? `Queued ${successCount} unsubscribe request(s). ${failed.length} failed.`
        : `Queued ${successCount} unsubscribe request(s).`

    return {
      statusCode: 200,
      message: msg,
      data: dto // echo request; or return { successCount, failed } if you prefer
      // You can also include extraData: { successCount, failed } if your response type supports it
    }
  }

  async resumeContacts(
    user: LoginUser,
    broadcastId: number,
    dto: PauseResumeContactsDto
  ): Promise<ApiUpdateResponseDto<PauseResumeContactsDto>> {
    console.log('dto: {}', dto)
    console.log('broadcastId: {}', broadcastId)

    if (
      !broadcastId ||
      !Array.isArray(dto.contactIds) ||
      dto.contactIds.length === 0
    ) {
      throw new BadRequestException(
        'broadcastId and a non-empty contactIds[] are required'
      )
    }

    const now = new Date()
    let successCount = 0
    const failed: Array<{ contactId: number; error: string }> = []

    for (const contactId of dto.contactIds) {
      try {
        const row = await this.prisma.contactPauseResumeRequest.create({
          data: {
            agencyId: user.agencyId!,
            userId: user.parentUserId || user.id!,
            createdBy: user.id!,
            broadcastId: broadcastId!, // model is BigInt?; DTO requires it
            contactId: contactId!,

            action: ContactAction.RESUME, // or PAUSE depending on semantics
            status: ContactPauseResumeRequestStatus.PENDING,

            failedReason: '', // required non-null column
            requestedAt: now,
            processedAt: null
          }
        })

        await createActivity({
          userId: user.parentUserId ?? user.id,
          agencyId: user.agencyId,
          createdBy: user.id,
          category: ActivityCategory.BROADCAST,
          action: ActivityAction.RESUME,
          description: `Contact ${contactId} resumed from broadcast ${broadcastId} by ${user.userName} at ${new Date().toLocaleString()}.`,
          contactId: BigInt(row.contactId),
          broadcastId: BigInt(row.broadcastId)
        })
        // optional log
        // this.logger?.debug?.(`Queued unsubscribe request id=${row.id} for contactId=${contactId}`);
        successCount++
      } catch (e: any) {
        // continue with others
        failed.push({
          contactId: Number(contactId),
          error: e?.message ?? String(e)
        })
      }
    }

    if (failed.length === dto.contactIds.length) {
      // all failed
      throw new InternalServerErrorException(
        'Failed to queue unsubscribe requests for all contacts.'
      )
    }

    const msg =
      failed.length > 0
        ? `Queued ${successCount} unsubscribe request(s). ${failed.length} failed.`
        : `Queued ${successCount} unsubscribe request(s).`

    return {
      statusCode: 200,
      message: msg,
      data: dto // echo request; or return { successCount, failed } if you prefer
      // You can also include extraData: { successCount, failed } if your response type supports it
    }
  }

  async pauseContacts(
    user: LoginUser,
    broadcastId: number,
    dto: PauseResumeContactsDto
  ): Promise<ApiUpdateResponseDto<PauseResumeContactsDto>> {
    console.log('dto: {}', dto)
    console.log('broadcastId: {}', broadcastId)

    if (
      !broadcastId ||
      !Array.isArray(dto.contactIds) ||
      dto.contactIds.length === 0
    ) {
      throw new BadRequestException(
        'broadcastId and a non-empty contactIds[] are required'
      )
    }

    const now = new Date()
    let successCount = 0
    const failed: Array<{ contactId: number; error: string }> = []

    for (const contactId of dto.contactIds) {
      try {
        const row = await this.prisma.contactPauseResumeRequest.create({
          data: {
            agencyId: user.agencyId!,
            userId: user.parentUserId || user.id!,
            createdBy: user.id!,
            broadcastId: broadcastId!, // model is BigInt?; DTO requires it
            contactId: contactId!,

            action: ContactAction.PAUSE, // or PAUSE depending on semantics
            status: ContactPauseResumeRequestStatus.PENDING,

            failedReason: '', // required non-null column
            requestedAt: now,
            processedAt: null
          }
        })

        await createActivity({
          userId: user.parentUserId ?? user.id,
          agencyId: user.agencyId,
          createdBy: user.id,
          category: ActivityCategory.BROADCAST,
          action: ActivityAction.PAUSE,
          description: `Contact ${contactId} paused from broadcast ${broadcastId} by ${user.userName} at ${new Date().toLocaleString()}.`,
          contactId: BigInt(row.contactId),
          broadcastId: BigInt(row.broadcastId)
        })

        // optional log
        // this.logger?.debug?.(`Queued unsubscribe request id=${row.id} for contactId=${contactId}`);
        successCount++
      } catch (e: any) {

        // continue with others
        failed.push({
          contactId: Number(contactId),
          error: e?.message ?? String(e)
        })
      }
    }

    if (failed.length === dto.contactIds.length) {
      // all failed
      throw new InternalServerErrorException(
        'Failed to queue unsubscribe requests for all contacts.'
      )
    }

    const msg =
      failed.length > 0
        ? `Queued ${successCount} unsubscribe request(s). ${failed.length} failed.`
        : `Queued ${successCount} unsubscribe request(s).`

    return {
      statusCode: 200,
      message: msg,
      data: dto // echo request; or return { successCount, failed } if you prefer
      // You can also include extraData: { successCount, failed } if your response type supports it
    }
  }

  /**
   * Adds contacts/segments to the BroadcastContactEntryQueue one-by-one.
   * - type=CONTACT   -> ids[] are contact IDs -> set contactId
   * - type=SEGMENT/TAG/FILE/GOOGLE_CONTACT -> ids[] are "source" IDs -> set sourceId
   */
  async addContactsToBroadcast(
    broadcastId: number,
    dto: AddBroadcastContactsDto,
    user: LoginUser
  ) {
    console.log('dto: {}', dto)
    console.log('broadcastId: {}', broadcastId)

    if (!broadcastId || !Array.isArray(dto.ids) || dto.ids.length === 0) {
      throw new BadRequestException(
        'broadcastId and a non-empty ids[] are required'
      )
    }

    // Validate broadcast & tenancy
    const broadcast = await this.prisma.broadcast.findFirst({
      where: {
        id: broadcastId!,
        agencyId: user.agencyId!
      },
      select: { id: true }
    })

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found or not accessible')
    }

    // Determine mapping for contactId/sourceId
    const isContactType = dto.type === BroadcastContactQueueSource.CONTACT
    const allowedTypes = new Set<BroadcastContactQueueSource>([
      BroadcastContactQueueSource.CONTACT,
      BroadcastContactQueueSource.SEGMENT,
      BroadcastContactQueueSource.TAG,
      BroadcastContactQueueSource.FILE,
      BroadcastContactQueueSource.GOOGLE_CONTACT
    ])

    if (!allowedTypes.has(dto.type)) {
      throw new BadRequestException(`Unsupported type: ${dto.type}`)
    }

    const now = new Date()
    let successCount = 0
    const failed: Array<{ id: number; error: string }> = []

    // De-duplicate incoming ids to avoid accidental duplicates
    const uniqueIds = Array.from(new Set(dto.ids.map((n) => Number(n))))

    for (const id of uniqueIds) {
      try {
        const data: Prisma.BroadcastContactEntryQueueCreateInput = {
          agencyId: user.agencyId!,
          userId: user.parentUserId || user.id!,
          createdBy: user.id!,
          broadcastId: broadcastId!,

          // map ids based on type
          contactId: isContactType ? id! : null,
          sourceId: isContactType ? null : id!,

          contactSource: dto.type,
          status: EntryStatus.PENDING,
          requestedAt: now,
          processedAt: null
        }

        const contacts = await this.prisma.broadcastContactEntryQueue.create({ data })

        await createActivity({
          userId: user.parentUserId ?? user.id,
          agencyId: user.agencyId,
          createdBy: user.id,
          category: ActivityCategory.CONTACT,
          action: ActivityAction.ASSIGN,
          description: `Queued ${contacts.id} for broadcast ${broadcastId} by ${user.userName} at ${new Date().toLocaleString()}.`,
          contactId: contacts.id,
          broadcastId: contacts.broadcastId
        })

        successCount++
      } catch (e: any) {
        // Continue processing others, collect failures
        failed.push({ id, error: e?.message ?? String(e) })
      }
    }

    if (successCount === 0) {
      throw new InternalServerErrorException('Failed to enqueue all items.')
    }
    return {
      statusCode: 200,
      message:
        failed.length > 0
          ? `Queued ${successCount} item(s); ${failed.length} failed.`
          : `Queued ${successCount} item(s).`,
      data: {
        broadcastId: broadcastId,
        type: dto.type,
        ids: dto.ids,
        successCount,
        failed
      }
    }
  }

  async getBroadcastContacts(
    user: LoginUser,
    broadcastId: number,
    query: BroadcastContactListParamDto
  ): Promise<ApiListResponseDto<BroadcastContactListItemDto>> {
    try {
      const {
        page = 1,
        perPage = 10,
        sortOn = 'id',
        sortDirection = 'desc',
        query: q,
        needPagination = true
      } = query ?? {}

      const qTrim = (q ?? '').toString().trim()

      //  pagination
      const safePerPage = Math.max(1, Math.min(100, Number(perPage)))
      const safePage = Math.max(1, Number(page))
      const offset = (safePage - 1) * safePerPage

      //  allow-list sorting
      const allowedSortFields = new Set([
        'id',
        'created_at',
        'status',
        'entry_date',
        'last_message_at',
        'next_allowed_message_at'
      ])
      const sortField = allowedSortFields.has(sortOn) ? sortOn : 'id'
      const sortDir = sortDirection.toLowerCase() === 'asc' ? 'asc' : 'desc'

      //  build WHERE condition dynamically
      let whereClause = `bc.broadcast_id = ${broadcastId} AND bc.agency_id = ${user.agencyId}`
      if (qTrim) {
        whereClause += ` AND (
        c.number LIKE '%${qTrim}%'
        OR c.first_name LIKE '%${qTrim}%'
        OR c.last_name LIKE '%${qTrim}%'
        OR c.email LIKE '%${qTrim}%'
      )`
      }

      //  base query
      const baseQuery = `
      FROM broadcast_contacts bc
      JOIN contacts c ON bc.contact_id = c.id
      WHERE ${whereClause}
    `

      //  total count
      const totalResult = await this.prisma.$queryRawUnsafe<
        { count: bigint }[]
      >(`SELECT COUNT(*) as count ${baseQuery}`)
      const total = Number(totalResult[0]?.count ?? 0)

      console.log('total: ', total)
      console.log('baseQuery: ', baseQuery)

      //  rows
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
      SELECT 
        c.id as contactId,
        c.first_name as firstName,
        c.last_name as lastName,
        c.email as email,
        c.number as phone,
        bc.status as status,
        bc.entry_date as entryDate,
        bc.last_message_at as lastMessageAt,
        bc.next_allowed_message_at as nextAllowedMessageAt,
        bc.created_at as createdAt
      ${baseQuery}
      ORDER BY bc.${sortField} ${sortDir}
      ${needPagination ? `LIMIT ${safePerPage} OFFSET ${offset}` : ''}
      `
      )

      //  map rows to DTO
      const data: BroadcastContactListItemDto[] = rows.map((r) => ({
        id: Number(r.contactId),
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        status: r.status ?? null,
        startDate: r.entryDate ?? r.createdAt ?? null,
        nextExecutionTime: r.nextAllowedMessageAt ?? null
      }))

      //  build response
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
          message: 'Contacts retrieved successfully.',
          data,
          pagination
        }
      }

      return {
        statusCode: 200,
        message: 'Contacts retrieved successfully.',
        data
      }
    } catch (err) {
      console.error('err: ', err)
      return {
        statusCode: 500,
        message:
          'An error occurred while fetching contacts for this broadcast.',
        data: []
      }
    }
  }

  /**
   * Pause a running or scheduled broadcast.
   */
  async pause(
    broadcastId: number,
    user: LoginUser,
    body: ChangeBroadcastBodyDto
  ) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId }
    })

    if (!broadcast) throw new NotFoundException('Broadcast not found')

    if (broadcast.status !== BroadcastStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot pause when status is ${broadcast.status}`
      )
    }

    // Optional: validate broadcast belongs to the agency/team here
    // const broadcast = await this.prisma.broadcast.findFirst({ where: { id: broadcastId, agencyId: user.agencyId }});
    // if (!broadcast) throw new NotFoundException('Broadcast not found for this agency');

    // Prevent duplicate pending requests for same broadcast/action
    const existing = await this.prisma.broadcastPauseResumeRequest.findFirst({
      where: {
        broadcastId: broadcastId,
        action: PauseResumeAction.PAUSE,
        status: BroadcastPauseResumeRequestStatus.PENDING
      }
    })

    if (existing) return existing

    // Create request
    const created = await this.prisma.broadcastPauseResumeRequest.create({
      data: {
        agencyId: user.agencyId, // BigInt
        createdBy: user.id, // BigInt
        userId: user.parentUserId || user.id, // BigInt
        broadcastId, // BigInt
        action: PauseResumeAction.PAUSE, // PauseResumeAction enum
        status: BroadcastPauseResumeRequestStatus.PENDING, // default workflow start
        failedReason: null, // nullable
        requestedAt: new Date() // now
      }
    })

    await this.pausedBroadcast(broadcast.id)

    return created
  }

  async pausedBroadcast(id: bigint) {
    const data: any = {
      status: BroadcastStatus.PAUSED,
      pausedAt: new Date()
    }
    return await this.update(id, data)
  }

  /**
   * Resume a paused broadcast. Can resume immediately or schedule for later.
   */
  async resume(
    broadcastId: number,
    user: LoginUser,
    body: ChangeBroadcastBodyDto
  ) {
    // 1) Ensure broadcast exists
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId }
    })
    if (!broadcast) throw new NotFoundException('Broadcast not found')

    // 2) Only allow resume from ACTIVE, PAUSED, or PAUSED_FOR_CREDIT
    const RESUMABLE_STATUSES: BroadcastStatus[] = [
      BroadcastStatus.ACTIVE,
      BroadcastStatus.PAUSED,
      BroadcastStatus.PAUSED_FOR_CREDIT
    ]

    if (!RESUMABLE_STATUSES.includes(broadcast.status)) {
      throw new BadRequestException(
        `Cannot resume when status is ${broadcast.status}`
      )
    }

    // 3) Prevent duplicate pending RESUME request
    const existing = await this.prisma.broadcastPauseResumeRequest.findFirst({
      where: {
        broadcastId: broadcastId,
        action: PauseResumeAction.RESUME,
        status: BroadcastPauseResumeRequestStatus.PENDING
      }
    })
    if (existing) return existing

    // 4) Create a new RESUME request
    const created = await this.prisma.broadcastPauseResumeRequest.create({
      data: {
        agencyId: user.agencyId, // BigInt
        userId: user.parentUserId || user.id, // BigInt
        createdBy: user.id, // BigInt
        broadcastId: broadcastId, // BigInt
        action: PauseResumeAction.RESUME, // enum
        status: BroadcastPauseResumeRequestStatus.PENDING, // start workflow
        failedReason: null,
        requestedAt: new Date() // now
      }
    })

    const data: any = {
      status: BroadcastStatus.RUNNING,
      startedAt: new Date()
    }

    await this.update(broadcast.id, data);

    return created
  }

  /**
   * Stop a running/paused/scheduled broadcast permanently.
   */
  async stop(
    broadcastId: number,
    user: LoginUser,
    body: ChangeBroadcastBodyDto
  ) {
    // 1) Ensure broadcast exists
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId }
    })

    if (!broadcast) throw new NotFoundException('Broadcast not found')

    const broadcastUpdate = await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: BroadcastStatus.STOP,
        updatedAt: new Date()
      }
    })

    const deleteQueue = await this.prisma.broadcastMessageQueue.deleteMany({
      where: {
        broadcastId: broadcastId
      }
    })

    console.log('deleteQueue: {}', deleteQueue)

    return broadcastUpdate
  }

  /**
   * Delete a broadcast (soft delete or hard delete depending on business rules).
   */
  async delete(
    broadcastId: number,
    user: LoginUser,
    body: ChangeBroadcastBodyDto
  ) {
    // 1) Ensure broadcast exists
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId }
    })

    if (!broadcast) throw new NotFoundException('Broadcast not found')

    const broadcastUpdate = await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: BroadcastStatus.DELETED,
        updatedAt: new Date()
      }
    })

    const deleteQueue = await this.prisma.broadcastMessageQueue.deleteMany({
      where: {
        broadcastId: broadcastId
      }
    })

    console.log('deleteQueue: {}', deleteQueue)

    return broadcastUpdate
  }

  async getBroadcastStats(userId: bigint): Promise<BroadcastStatsResponseDTO> {
    const defaultStats: BroadcastStatsResponseDTO = {
      totalBroadcasts: 0,
      totalRunning: 0,
      totalPaused: 0,
      totalCompleted: 0,
      totalDeleted: 0,
      totalPausedForCredit: 0,
      totalContacted: 0,
      totalOptout: 0
    }

    if (!userId) {
      return defaultStats
    }
    try {
      const result = await this.prisma.$queryRaw<BroadcastStatsResponseDTO[]>`
      SELECT 
        COUNT(*) AS totalBroadcasts,
        SUM(status = 'RUNNING') AS totalRunning,
        SUM(status = 'PAUSED' OR status = 'PAUSED_FOR_CREDIT') AS totalPaused,
        SUM(status = 'COMPLETED') AS totalCompleted,
        SUM(status = 'DELETED') AS totalDeleted,
        SUM(status = 'PAUSED_FOR_CREDIT') AS totalPausedForCredit,
        SUM(total_contacted) as totalContacted
      FROM broadcasts
      WHERE user_id = ${userId}`

      return result[0] || defaultStats
    } catch (error) {
      this.logger.error(error)
    }
  }

/**
 * 🟢 Method: incrementTotalContactCount
 * --------------------------------
 * Atomically increments the total contact count in a broadcast summary.
 * - Inserts a new summary record if not found.
 * - Uses a transaction to ensure data consistency under concurrency.
 * - Automatically updates `updatedAt` timestamp.
 *
 * @param broadcastId - Unique broadcast identifier
 */
async incrementTotalContactCount(broadcastId: bigint): Promise<void> {

  try {
  
    await this.prisma.$transaction(async (tx) => {
      // 🏷️ Try to find existing broadcast summary
      const summary = await tx.broadcastSummary.findUnique({
        where: { broadcastId },
      });

      // 🏷️ If not found, create a new one with totalContact = 1
      if (!summary) {
        await tx.broadcastSummary.create({
          data: {
            broadcastId,
            totalContact: 1,
            totalConnected: 0,
            totalPaused: 0,
            totalUnsubscribed: 0,
            totalOptout: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        return;
      }

      // 🏷️ Increment total contact count atomically
      await tx.broadcastSummary.update({
        where: { broadcastId },
        data: {
          totalContact: { increment: 1 },
          updatedAt: new Date(),
        },
      });

    });
  } catch (error) {
    // 🚨 Log and rethrow error with context
    console.error('❌ Error incrementing total contact count for broadcast:', {
      broadcastId,
      message: error instanceof Error ? error.message : error,
    });

  }

}


/**
 * 🟢 Method: incrementUnsubscribedCount
 * --------------------------------
 * Atomically increments the unsubscribed contact count in a broadcast summary.
 * - Inserts a new summary record if not found.
 * - Uses a transaction to ensure consistency under concurrency.
 * - Automatically updates `updatedAt` timestamp.
 *
 * @param broadcastId - Unique broadcast identifier
 */
  async incrementUnsubscribedCount(broadcastId: bigint): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 🏷️ Try to find existing broadcast summary
        const summary = await tx.broadcastSummary.findUnique({
          where: { broadcastId },
        });

        // 🏷️ If not found, create a new one with totalUnsubscribed = 1
        if (!summary) {
          await tx.broadcastSummary.create({
            data: {
              broadcastId,
              totalContact: 0,
              totalConnected: 0,
              totalPaused: 0,
              totalOptout: 0,
              totalUnsubscribed: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          return;
        }

        // 🏷️ Increment unsubscribed count atomically
        await tx.broadcastSummary.update({
          where: { broadcastId },
          data: {
            totalUnsubscribed: { increment: 1 },
            updatedAt: new Date(),
          },
        });

      });
    } catch (error) {
      // 🚨 Log and rethrow the error for traceability
      console.error('❌ Error incrementing unsubscribed count for broadcast:', {
        broadcastId,
        message: error instanceof Error ? error.message : error,
      });

    }

  }

  /**
 * 🟢 Method: incrementPausedCount
 * --------------------------------
 * Atomically increments the paused contact count in a broadcast summary.
 * - Inserts a new summary record if not found.
 * - Uses a transaction to ensure safe concurrent updates.
 * - Updates `updatedAt` timestamp automatically.
 *
 * @param broadcastId - Unique broadcast identifier
 */
  async incrementPausedCount(broadcastId: bigint): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 🏷️ Try to find the existing summary record
        const summary = await tx.broadcastSummary.findUnique({
          where: { broadcastId },
        });

        // 🏷️ If not found, create a new record with totalPaused = 1
        if (!summary) {
          await tx.broadcastSummary.create({
            data: {
              broadcastId,
              totalContact: 0,
              totalConnected: 0,
              totalPaused: 1,
              totalUnsubscribed: 0,
              totalOptout: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          return;
        }

        // 🏷️ Atomically increment the paused count
        await tx.broadcastSummary.update({
          where: { broadcastId },
          data: {
            totalPaused: { increment: 1 },
            updatedAt: new Date(),
          },
        });

      });
    } catch (error) {
      // 🚨 Log error details with context
      console.error('❌ Error incrementing paused count for broadcast:', {
        broadcastId,
        message: error instanceof Error ? error.message : error,
      });

    }
  }

  /**
 * 🟢 Method: incrementOptoutCount
 * --------------------------------
 * Atomically increments the opt-out contact count in a broadcast summary.
 * - Inserts a new summary record if not found.
 * - Uses a transaction to ensure consistency under concurrency.
 * - Automatically updates `updatedAt` timestamp.
 *
 * @param broadcastId - Unique broadcast identifier
 */
  async incrementOptoutCount(broadcastId: bigint): Promise<void> {

    try {
      await this.prisma.$transaction(async (tx) => {
        // 🏷️ Try to find the existing summary record
        const summary = await tx.broadcastSummary.findUnique({
          where: { broadcastId },
        });

        // 🏷️ If not found, create a new record with totalOptout = 1
        if (!summary) {
          await tx.broadcastSummary.create({
            data: {
              broadcastId,
              totalContact: 0,
              totalConnected: 0,
              totalPaused: 0,
              totalUnsubscribed: 0,
              totalOptout: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          return;
        }

        // 🏷️ Atomically increment the opt-out count
        await tx.broadcastSummary.update({
          where: { broadcastId },
          data: {
            totalOptout: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      });
    } catch (error) {
      // 🚨 Log error details with context
      console.error('❌ Error incrementing opt-out count for broadcast:', {
        broadcastId,
        message: error instanceof Error ? error.message : error,
      });

    }
    
  }



  /**
   * 🟢 Method: decrementPausedCount
   * --------------------------------
   * Atomically decrements the paused contact count in a broadcast summary.
   * - Inserts a new summary record if not found.
   * - Prevents `totalPaused` from going below zero (DB-level safeguard).
   * - Uses a transaction to ensure data consistency under concurrency.
   *
   * @param broadcastId - Unique broadcast identifier
   */
  async decrementPausedCount(broadcastId: bigint): Promise<void> {
    try {
      // 🏷️ Use a transaction to ensure data consistency
      await this.prisma.$transaction(async (tx) => {
        // 🏷️ Try to find an existing summary first
        const summary = await tx.broadcastSummary.findUnique({
          where: { broadcastId },
        });

        // 🏷️ If not found, create a new one and exit
        if (!summary) {
          await tx.broadcastSummary.create({
            data: {
              broadcastId,
              totalContact: 0,
              totalConnected: 0,
              totalPaused: 0,
              totalUnsubscribed: 0,
              totalOptout: 0,
            },
          });
          return;
        }

        // 🏷️ Atomically decrement while preventing negative values
        await tx.$executeRawUnsafe(`
            UPDATE broadcast_summaries
            SET total_paused = GREATEST(total_paused - 1, 0),
                updated_at = NOW(3)
            WHERE broadcast_id = ${broadcastId}
          `);

      });

    } catch (error) {
      // 🚨 Log error details for debugging
      console.error('❌ Error decrementing paused count for broadcast:', {
        broadcastId,
        message: error instanceof Error ? error.message : error,
      });
    }
  }



  /**
   * @getBroadcastSequenceQueueStats
   * @param broadcastId 
   * @returns 
   */
  async getBroadcastSequenceQueueStats(broadcastId: number): Promise<BroadcastSettingStatsDTO[]> {
    if (!broadcastId) {
      return [];
    }
    try {
      const status = QueueStatus.PENDING;
      const result = await this.prisma.$queryRaw<
        { broadcastSettingId: number; totalQueue: number }[]>`
        SELECT bs.broadcast_setting_id AS broadcastSettingId,
          COALESCE(COUNT(bmq.id), 0) AS totalQueue,
            COALESCE(MAX(bs.total_sent), 0) AS totalSent,
            COALESCE(MAX(bs.total_failed), 0) AS totalFailed,
            COALESCE(MAX(bs.total_read), 0) AS totalRead,
            COALESCE(MAX(bs.total_delivered), 0) AS totalDelivered,
            COALESCE(MAX(bs.total_undelivered), 0) AS totalUndelivered
      FROM broadcast_settings_stats bs
      LEFT JOIN broadcast_message_queues bmq ON bs.broadcast_setting_id = bmq.broadcast_setting_id
           AND bmq.broadcast_id = ${broadcastId}
           AND bmq.status = 'PENDING'
      WHERE bs.broadcast_id = ${broadcastId}
      GROUP BY bs.broadcast_setting_id
      
      UNION ALL

      SELECT bmq.broadcast_setting_id AS broadcastSettingId,
        COUNT(bmq.id) AS totalQueue,
        0 AS totalSent, 0 AS totalFailed, 0 AS totalRead, 0 AS totalDelivered, 0 AS totalUndelivered
      FROM broadcast_message_queues bmq
      LEFT JOIN broadcast_settings_stats bs  ON bmq.broadcast_setting_id = bs.broadcast_setting_id AND bmq.broadcast_id = bs.broadcast_id
      WHERE bmq.broadcast_id = ${broadcastId}
      AND bmq.status = 'PENDING'
      AND bs.broadcast_setting_id IS NULL
      GROUP BY bmq.broadcast_setting_id`;

      return result;
    } catch (error) {
      this.logger.error(error);
    }
    return [];
  }

  async getBroadcastSettingDetails(broadcastId: number, broadcastSettingId: number,
    request: any
  ): Promise<{ total: number; data: BroadcastSettingDetailResponse[] }> {
    let searchCondition = '';
    const requestStatus = BroadcastSettingDetailStatus[request.status.toUpperCase() as keyof typeof BroadcastSettingDetailStatus];

    const offset = (request.currentPage - 1) * request.perPage;

    let selectFields = 'c.id, c.first_name as firstName, c.last_name as lastName, c.email, c.number';
    let table = '';
    let statusCondition = '';

    switch (requestStatus) {
      case BroadcastSettingDetailStatus.QUEUED:
        table = 'broadcast_message_queues b';
        selectFields += ', b.sent_at as scheduleTime, b.created_at createdAt';
        statusCondition = `AND b.status = '${QueueStatus.PENDING}'`;
        break;
      case BroadcastSettingDetailStatus.SENT:
      case BroadcastSettingDetailStatus.DELIVERED:
        table = 'broadcast_message_logs b';
        selectFields += ', b.last_message_at AS sentAt';
        statusCondition = `AND b.status IN ('${BroadcastLogStatus.DELIVERED}', '${BroadcastLogStatus.SENT}')`;
        break;
      case BroadcastSettingDetailStatus.FAILED:
      case BroadcastSettingDetailStatus.UNDELIVERED:
        table = 'broadcast_message_logs b';
        selectFields += ', b.error_message AS failedReason';
        statusCondition = `AND b.status IN ('${BroadcastLogStatus.FAILED}', '${BroadcastLogStatus.UNDELIVERED}')`;
        break;
      case BroadcastSettingDetailStatus.READ:
        table = 'broadcast_message_logs b';
        selectFields += ', b.updated_at AS readAt';
        statusCondition = `AND b.status = '${BroadcastLogStatus.READ}'`;
        break;
      default:
        break
    }
    // Add search condition if exists
    if (request.searchKey && request.searchKey.trim() !== '') {
      searchCondition = `
            AND (
              c.first_name LIKE '%${request.searchKey}%' OR
              c.last_name LIKE '%${request.searchKey}%' OR
              c.email LIKE '%${request.searchKey}%' OR
              c.number LIKE '%${request.searchKey}%'
            )`;
    }

    let query = `
          SELECT ${selectFields}
          FROM ${table}
          INNER JOIN contacts c ON c.id = b.contact_id
          WHERE b.broadcast_id = ${broadcastId}
            AND b.broadcast_setting_id = ${broadcastSettingId}
            ${statusCondition}
            ${searchCondition}
            LIMIT ${request.perPage}
            OFFSET ${offset}
        `;
    console.log('query..........', query);
    // --- Query for total count ---
    const countQuery = `
          SELECT COUNT(*) AS total
          FROM ${table}
          INNER JOIN contacts c ON c.id = b.contact_id
          WHERE b.broadcast_id = ${broadcastId}
            AND b.broadcast_setting_id = ${broadcastSettingId}
            ${statusCondition}
            ${searchCondition}
        `;
    const [data, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<BroadcastSettingDetailResponse[]>(query),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(countQuery),
    ]);

    // return await this.prisma.$queryRawUnsafe(query);
    return {
      total: countResult[0]?.total || 0,
      data,
    };
  }


}
