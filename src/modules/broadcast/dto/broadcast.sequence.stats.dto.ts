export class BroadcastSettingStatsDTO {
  broadcastSettingId: number
  totalQueue?: number
  totalSent?: number
  totalFailed?: number
  totalRead?: number
  totalDelivered?: number
  totalUndelivered?: number
}

export interface BroadcastSettingDetailResponse {
  contactId?: number
  firstName?: string
  lastName?: string
  email?: string
  number: string
  scheduleTime?: string
  createdAt: string
  sentAt?: string
  failedReason?: string
  readAt?: string
}

export enum BroadcastSettingDetailStatus{
    QUEUED,
    SENT,
    FAILED,
    READ,
    DELIVERED,
    UNDELIVERED
}