// broadcast-settings-priority.service.ts
import { Injectable } from '@nestjs/common';
import { BroadcastType, BroadcastSetting, BroadcastSettingStatus } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';

type SettingForSort = Pick<
    BroadcastSetting,
    'id' | 'broadcast_type' | 'day' | 'time' | 'createdAt'
>;

@Injectable()
export class BroadcastSettingsPriorityService {
    constructor(private readonly prisma: PrismaService) { }

    private typeRank(type: BroadcastType): number {
        switch (type) {
            case BroadcastType.IMMEDIATE: return 0;
            case BroadcastType.SCHEDULE: return 1;
            case BroadcastType.RECURRING: return 2;
            default: return 99;
        }
    }

    private nullSafe<T>(v: T | null | undefined, high: T): T {
        return (v ?? high) as T;
    }

    /** Normalize prisma Date (including TIME-as-Date) to ms; nulls → MAX_SAFE_INTEGER */
    private toMs(d: Date | null): number {
        return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
    }

    /** Build full sort key with tie-breakers */
    private sortKey(s: SettingForSort) {
        const rank = this.typeRank(s.broadcast_type);
        const dayKey = this.nullSafe<number>(s.day as any, 9999);
        const timeKey = this.toMs(s.time);
        const created = this.toMs(s.createdAt);
        // NOTE: Number(bigint) is fine for compare/order (we’re not doing math that overflows)
        const idKey = Number(s.id);

        if (s.broadcast_type === BroadcastType.IMMEDIATE) {
            // IMMEDIATE: type → time → createdAt → id
            return [rank, timeKey, created, idKey] as const;
        }
        // SCHEDULE/RECURRING: type → day → time → createdAt → id
        return [rank, dayKey, timeKey, created, idKey] as const;
    }

    async recalcPriorities(broadcastId: bigint | number): Promise<void> {
        const bId = typeof broadcastId === 'number' ? BigInt(broadcastId) : broadcastId;

        const settings: SettingForSort[] = await this.prisma.broadcastSetting.findMany({
            where: { broadcastId: bId, status: BroadcastSettingStatus.ACTIVE },
            // fetching only fields we sort on
            select: {
                id: true,
                broadcast_type: true,
                day: true,
                time: true,
                createdAt: true,
            },
        });

        console.log('recalcPriorities settings', settings); 

        const sorted = settings.sort((a, b) => {
            const ka = this.sortKey(a);
            const kb = this.sortKey(b);
            for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
                const da = (ka[i] ?? 0) as number;
                const db = (kb[i] ?? 0) as number;
                if (da !== db) return da - db;
            }
            return 0;
        });

        console.log('recalcPriorities sorted', sorted);

        // Assign 0..N-1 priorities deterministically
        const updates = sorted.map((s, idx) =>
            this.prisma.broadcastSetting.update({
                where: { id: s.id },
                data: { priority: idx },
            }),
        );

        await this.prisma.$transaction(updates);
    }
}
