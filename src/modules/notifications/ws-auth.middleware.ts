import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'nestjs-prisma';
import { Socket } from 'socket.io';
import type { SocketAuthUser } from 'src/types/socket';



@Injectable()
export class WsAuthMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async use(socket: Socket, next: (err?: Error) => void) {
        const token = socket.handshake.auth.token || socket.handshake.query.token;


        if (!token) {
            return next(new UnauthorizedException('No authentication token provided'));
        }

        try {
            // Verify JWT
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET,
                ignoreExpiration: false,
            });

            // Validate token in Prisma
            const tokenDoc = await this.prisma.token.findFirst({
                where: {
                    token,
                    type: 'ACCESS',
                    blacklisted: false,
                },
                select: {
                    userId: true,
                },
            });

            if (!tokenDoc) {
                return next(new UnauthorizedException('Invalid or blacklisted token'));
            }

            // Fetch minimal user data
            const userData = await this.prisma.user.findFirst({
                where: {
                    id: tokenDoc.userId,
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    agencyId: true,
                    parentUserId: true,
                },
            });

            if (!userData) {
                return next(new UnauthorizedException('User not found or inactive'));
            }

            // Attach user to socket
            const wsUser: SocketAuthUser = {
                userId: userData.id,
                agencyId: userData.agencyId,
            };
            socket.data.user = wsUser;

            next();
        } catch (error) {
            return next(new UnauthorizedException('Invalid or expired token'));
        }
    }
}