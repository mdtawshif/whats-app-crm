// src/notifications/token.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { TokenService } from './token.service';
import { TokenType } from '@prisma/client';
import { SetTokenDto } from './dto/set-token.dto';
import { AuthGuard } from '@/common/guard/auth.guard';

@Controller('notifications/tokens')
@UseGuards(AuthGuard)
export class TokenController {
    constructor(private readonly tokenService: TokenService) { }

    @Post()
    async setToken(@Req() req, @Body() dto: SetTokenDto) {
        await this.tokenService.setToken(req.user.id, req.user.agencyId, dto.token, dto.type || TokenType.FCM);
        return { success: true };
    }
}