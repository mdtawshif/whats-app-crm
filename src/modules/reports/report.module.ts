import { Module } from '@nestjs/common';
import { PrismaModule, PrismaService } from 'nestjs-prisma';
import { ApiKeyGuard } from '@/common/guard/api-key.guard';
import { AuthGuard } from '@/common/guard/auth.guard';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { TriggerEventManager } from '../trigger/services/trigger-event-manager/trigger-event-manager.service';
@Module({
  imports: [ PrismaModule],
  controllers: [ReportController],
  providers: [ReportService, PrismaService, TriggerEventManager, ApiKeyGuard, AuthGuard],
  exports: [ReportService],
})
export class ReportModule { }
