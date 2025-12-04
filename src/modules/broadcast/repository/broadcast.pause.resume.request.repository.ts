import { Injectable } from "@nestjs/common";
import { BroadcastPauseResumeRequest, BroadcastPauseResumeRequestStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";


@Injectable()
export class BroadcastPauseResumeRequestRepository {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ) { }


    /**
     * @find pending pause resume request
     * @param id 
     * @param BATACH_SIZE 
     * @returns 
     */
    async findPendingRequests(id: bigint, limitSize: number): Promise<BroadcastPauseResumeRequest[]> {
        try {
            return await this.prisma.broadcastPauseResumeRequest.findMany({
                where: {
                    id: {
                        gt: id
                    },
                    status: BroadcastPauseResumeRequestStatus.PENDING,
                },
                take: limitSize
            });
        } catch (error) {
            this.logger.error(error);
        }
        return [];
    }

    /**
     * @update status 
     * @param ids 
     * @param status 
     */
    async updateStatus(ids: bigint[], status: BroadcastPauseResumeRequestStatus) {
        try {
            await this.prisma.broadcastPauseResumeRequest.updateMany({
                where: {
                    id: {
                        in: ids
                    }
                }, data: {
                    status: status,
                    processedAt: new Date()
                }
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

    async update(ids:bigint[], data: any) {
        try {
            await this.prisma.broadcastPauseResumeRequest.updateMany({
                where: {
                    id: {
                        in: ids
                    }
                }, data: {
                     ...data,
                    processedAt: new Date()
                }
            });
        } catch (error) {
            this.logger.error(error);
        }
    }

}