import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { BroadcastSettingDTO } from "../dto/broadcast.setting.dto";
import { BroadcastSetting, BroadcastSettingStatus, BroadcastType } from "@prisma/client";

@Injectable()
export class BroadcastSettingRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ){}

    async findBroadcastRecurringSettings(broadcastId: bigint): Promise<BroadcastSettingDTO[]>{
        if(broadcastId == null){
            return [];
        }
        try{
           const broadcastSetting = await this.prisma.broadcastSetting.findMany({
                where:{
                    broadcastId: broadcastId,
                    status:BroadcastSettingStatus.ACTIVE,
                    broadcast_type: BroadcastType.RECURRING
                },select:{
                    id: true,
                    broadcast_type:true,
                    day: true,
                    time: true,
                    priority: true,
                    waBusinessNumberId: true,
                    messageTemplateId: true,
                }
            })
            if(!broadcastSetting || broadcastSetting.length ===0){
                return [];
            }
            return broadcastSetting.map(s => ({
                    id: s.id,
                    broadcastType: s.broadcast_type,
                    day: s.day,
                    priority: s.priority,
                    time: s.time.toTimeString().split(" ")[0], // convert Date -> "HH:mm:ss"
                    waBusinessNumberId: s.waBusinessNumberId,
                    messageTemplateId: s.messageTemplateId
            }));
        }catch(error){
            this.logger.error(error);
        }
        return [];
    }

    async findFirstBroadcastSetting(broadcastId: bigint, priority: number): Promise<BroadcastSettingDTO[]>{
        if(broadcastId == null){
            return [];
        }
        try{
           const broadcastSetting = await this.prisma.broadcastSetting.findMany({
                where:{
                    broadcastId: broadcastId,
                    status:BroadcastSettingStatus.ACTIVE,
                    broadcast_type: {
                     in:[BroadcastType.IMMEDIATE, BroadcastType.SCHEDULE]
                    },
                    priority:{
                        gt: priority
                    }
                },
                orderBy:{
                    priority:'asc'
                },select:{
                    id: true,
                    broadcast_type:true,
                    day: true,
                    time: true,
                    priority: true,
                    waBusinessNumberId: true,
                    messageTemplateId: true,
                }
            })
            if(!broadcastSetting || broadcastSetting.length === 0){
                return [];
            }
            return broadcastSetting.map(s => ({
                    id: s.id,
                    broadcastType: s.broadcast_type,
                    day: s.day,
                    priority: s.priority,
                    time: s.time.toTimeString().split(" ")[0], // convert Date -> "HH:mm:ss"
                    waBusinessNumberId: s.waBusinessNumberId,
                    messageTemplateId: s.messageTemplateId
            }));
        }catch(error){
            this.logger.error(error);
        }
        return [];
    }

    async findBroadcastSettingById(broadcastSettingId: bigint): Promise<BroadcastSetting | null>{
        if(broadcastSettingId == null){
            return null;
        }
        try{
           const broadcastSetting = await this.prisma.broadcastSetting.findUnique({
                where:{
                    id: broadcastSettingId,
                }
            })
            return broadcastSetting;
        }catch(error){
            this.logger.error(error);
        }
        return null;
    }   
    
    
    async findHigherPriorityForwardSetting(broadcastId: bigint, priority: number): Promise<BroadcastSettingDTO[]>{
        if(broadcastId == null){
            return [];
        }
        try{
           const broadcastSetting = await this.prisma.broadcastSetting.findMany({
                where:{
                    broadcastId: broadcastId,
                    status:BroadcastSettingStatus.ACTIVE,
                    broadcast_type: BroadcastType.SCHEDULE,
                    priority:{
                        gt: priority
                    }
                },
                orderBy:{
                    priority:'asc'
                },select:{
                    id: true,
                    broadcast_type:true,
                    day: true,
                    time: true,
                    priority: true,
                    waBusinessNumberId: true,
                    messageTemplateId: true,
                }
            })
            if(!broadcastSetting || broadcastSetting.length === 0){
                return [];
            }
            return broadcastSetting.map(s => ({
                    id: s.id,
                    broadcastType: s.broadcast_type,
                    day: s.day,
                    priority: s.priority,
                    time: s.time.toTimeString().split(" ")[0], // convert Date -> "HH:mm:ss"
                    waBusinessNumberId: s.waBusinessNumberId,
                    messageTemplateId: s.messageTemplateId
            }));
        }catch(error){
            this.logger.error(error);
        }
        return [];
    }

}