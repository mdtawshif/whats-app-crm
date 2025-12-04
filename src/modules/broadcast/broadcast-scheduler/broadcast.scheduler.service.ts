import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaServiceOptions } from "nestjs-prisma";
import { BroadcastPauseResumeRequestRepository } from "../repository/broadcast.pause.resume.request.repository";
import { BroadcastPauseResumeRequest, BroadcastPauseResumeRequestStatus, BroadcastStatus } from "@prisma/client";
import { BroadcastService } from "../broadcast.service";
import { BroadcastMessageQueueRepository } from "../repository/broadcast.message.queue.repository";
import { BroadcastContactRepository } from "../repository/broadcast.contact.repository";

/**
 * @author @Milton
 */
@Injectable()
export class BroadcastSchedulerService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly broadcastPauseResumeRequestRepository: BroadcastPauseResumeRequestRepository,
        private readonly broadcastService: BroadcastService,
        private readonly broadcastMessageQueueRepository: BroadcastMessageQueueRepository,
        private readonly broadcastContactRepository: BroadcastContactRepository
    ) { }


    async findPendingPauseResumeRequest(id: bigint, batchSize: number): Promise<BroadcastPauseResumeRequest[]> {
        return await this.broadcastPauseResumeRequestRepository.findPendingRequests(id, batchSize);
    }

    async updateBroadcastPauseResumeRequestStatus(ids: bigint[], broadcastPauseResumeRequestStatus: BroadcastPauseResumeRequestStatus) {
        await this.broadcastPauseResumeRequestRepository.updateStatus(ids, broadcastPauseResumeRequestStatus);
    }

    async updateBroadcastPauseResumeRequest(ids: bigint[], data: any) {
        await this.broadcastPauseResumeRequestRepository.update(ids, data);
    }

    async changeBroadcastStatus(id: bigint, data: any) {
        return await this.broadcastService.update(id, data);
    }

    async removeBroadcastQueues(broadcastId: bigint) {
        await this.broadcastMessageQueueRepository.removeBroadcastQueues(broadcastId);
    }

    async findActiveBroadcastContacts(broadcastId: bigint, contactId: bigint, limit: number) {
        return await this.broadcastContactRepository.findActiveBroadcastContacts(broadcastId, contactId, limit);
    }
}