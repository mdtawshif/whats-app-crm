import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  BroadcastContactQueueSource,
  BroadcastStatus,
  ContactForwardQueueStatus
} from '@prisma/client'
import { Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator'
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto'

export class BroadcastContactListParamDto extends BasePaginationDto {} // re-use page/perPage/query/etc.

// Shape of each contact row in the response
export class BroadcastContactListItemDto {
  id!: number
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null // mapped from Contact.number
  status: string | null // e.g., from queue/status mapping
  startDate: Date | null // when this contact’s broadcast starts
  nextExecutionTime: Date | null // next scheduled execution time
}

export class BroadcastDto {
  @ApiProperty()
  id: bigint

  @ApiProperty({ required: true })
  title: string

  @ApiProperty()
  agencyId: bigint

  @ApiProperty({ required: false })
  teamId?: bigint

  @ApiProperty()
  userId: bigint

  @ApiProperty()
  status: string // You can map BroadcastStatus enum here

  @ApiProperty({ required: false })
  createdAt?: Date

  @ApiProperty({ required: false })
  startedAt?: Date

  @ApiProperty({ required: false })
  pausedAt?: Date

  @ApiProperty({ required: false })
  errorMessage?: string

  @ApiProperty()
  totalContacted: number

  @ApiProperty()
  rescheduleDueToRateLimit: boolean
}

export class BroadcastResponseDto {
  @ApiProperty() id!: number

  @ApiProperty() agencyId!: number
  @ApiProperty({ required: false, nullable: true }) teamId?: number
  @ApiProperty() userId!: number

  @ApiProperty({ required: true })
  wabaId!: string

  @ApiProperty() title!: string
  @ApiProperty({ enum: BroadcastStatus }) status!: BroadcastStatus

  @ApiProperty({ required: false, type: String, nullable: true })
  createdAt?: Date
  @ApiProperty({ required: false, type: String, nullable: true })
  updatedAt?: Date
  @ApiProperty({ required: false, type: String, nullable: true })
  startedAt?: Date
  @ApiProperty({ required: false, type: String, nullable: true })
  pausedAt?: Date

  @ApiProperty({ required: false, nullable: true }) errorMessage?: string
  @ApiProperty() totalContacted!: number
  @ApiProperty() rescheduleDueToRateLimit!: boolean

  // New fields
  @ApiProperty() fromDate!: Date
  @ApiProperty() toDate!: Date
  @ApiProperty({ isArray: true, example: ['Monday', 'Wednesday'] })
  selectedDays!: string[]
  @ApiProperty({ example: '09:00' }) startTime!: string // HH:mm
  @ApiProperty({ example: '17:00' }) endTime!: string // HH:mm
}

// ===== DTO for request body =====
export class UnsubscribeContactsDto {
  @ApiProperty({
    description: 'Contact IDs to unsubscribe',
    example: [101, 102, 103],
    isArray: true,
    type: Number
  })
  @Type(() => Number)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  contactIds!: number[]
}

export enum PauseResumeAction {
  PAUSE = 'Pause',
  RESUME = 'Resume'
}

export class PauseResumeContactsDto {
  @ApiProperty({
    description: 'Contact IDs to update',
    example: [101, 102, 103],
    isArray: true,
    type: Number
  })
  @Type(() => Number)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  contactIds!: number[]

  @ApiProperty({
    description: 'Action to perform',
    enum: PauseResumeAction,
    example: PauseResumeAction.PAUSE
  })
  @IsEnum(PauseResumeAction)
  action!: PauseResumeAction
}

export class AddBroadcastContactsDto {
  @ApiProperty({
    enum: BroadcastContactQueueSource,
    example: BroadcastContactQueueSource.SEGMENT
  })
  @IsEnum(BroadcastContactQueueSource)
  type!: BroadcastContactQueueSource

  // NOTE: using "Ids" (capital I) to match your payload exactly
  @ApiProperty({
    name: 'Ids',
    description:
      'If type=contactList → Contact IDs. If type=segment → Segment IDs.',
    isArray: true,
    type: Number,
    example: [1, 2, 3]
  })
  @Type(() => Number)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  ids!: number[]
}

export enum BroadcastAction {
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  STOP = 'STOP',
  DELETE = 'DELETE'
}

export class ChangeBroadcastBodyDto {
  @ApiProperty({ enum: BroadcastAction, description: 'Action to perform' })
  @IsEnum(BroadcastAction)
  action: BroadcastAction

  @ApiPropertyOptional({ description: 'Reason for pausing/stopping' })
  @IsOptional()
  @IsString()
  reason?: string
}

export class BroadcastStatsResponseDTO {
  @ApiProperty()
  totalBroadcasts: number
  @ApiProperty()
  totalRunning: number
  @ApiProperty()
  totalPaused: number
  @ApiProperty()
  totalCompleted: number
  @ApiProperty()
  totalDeleted: number
  @ApiProperty()
  totalPausedForCredit: number
  @ApiProperty()
  totalContacted: number
  @ApiProperty()
  totalOptout: number
}

export class ContactForwardQueueDTO {
  agencyId: bigint
  userId: bigint
  broadcastId: bigint
  contactId: bigint
  broadcastSettingId: bigint
  status: ContactForwardQueueStatus
  failedReason?: string
}

export class BroadcastSettingStatsCreateDto {
  userId: bigint
  agencyId: bigint
  broadcastId: bigint
  broadcastSettingId: bigint
  totalSent?: number
  totalFailed?: number
  totalRead?: number
  totalDelivered?: number
  totalUndelivered?: number
}