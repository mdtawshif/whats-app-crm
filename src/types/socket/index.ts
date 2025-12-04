import { Socket } from 'socket.io';

export type SocketAuthUser = {
    userId: bigint;
    agencyId: bigint | null;
};

// Explicitly define the data property to avoid type inference issues
export interface TypedSocketWithUser extends Socket {
    data: {
        user: SocketAuthUser;
    };
}