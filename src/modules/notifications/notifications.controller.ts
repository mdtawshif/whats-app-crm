import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { NotificationService } from './notifications.service';
import { AuthGuard } from '@/common/guard/auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Notification')
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }
    //sendOfflinePush

    @Post('send-offline-push')
    async sendOfflinePush(@Req() req, @Body() dto: any) {
        return this.notificationService.sendOfflinePush(req.user.id, dto);
    }

    @Get()
    async getNotifications(
        @Req() req,
        @Query() dto: GetNotificationsDto,
    ) {
        const read = dto.read === 'true' ? true : dto.read === 'false' ? false : undefined;

        return this.notificationService.getNotifications(
            req.user.id,
            dto.query,
            dto.limit,
            dto.page,
            { type: dto.type, read },
        );
    }

    @Get('unread-count')
    async getUnreadNotificationCount(@Req() req) {
        const count = await this.notificationService.getUserUnreadNotificationCount(req.user.id);
        return { count };
    }

    @Patch(':id/read')
    async markAsRead(@Req() req, @Param('id') id: bigint, @Body() dto: MarkReadDto) {
        if (dto.read) {
            await this.notificationService.markAsRead(id, req.user.id);
        } else {
            await this.notificationService.markAsUnread(id, req.user.id);
        }
        return { success: true };
    }

    @Delete(':id')
    async deleteNotification(@Req() req, @Param('id') id: bigint) {
        await this.notificationService.deleteNotification(id, req.user.id);
        return { success: true };
    }

    @Delete('all')
    async deleteAllNotifications(@Req() req) {
        await this.notificationService.deleteAllNotifications(req.user.id);
        return { success: true };
    }
}