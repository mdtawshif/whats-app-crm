import { BroadcastContactStatus } from "@prisma/client";

export const BroadcastContactStatusTriggerAction = {
    PAUSED: BroadcastContactStatus.PAUSED,
    UNSUBSCRIBE: BroadcastContactStatus.UNSUBSCRIBE,
} as const;

export type BroadcastContactStatusTriggerAction =
    (typeof BroadcastContactStatusTriggerAction)[keyof typeof BroadcastContactStatusTriggerAction];
