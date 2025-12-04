import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiParam, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { PrismaService } from 'nestjs-prisma';
import { AuthGuard } from '@/common/guard/auth.guard';
import { LoginUser } from '../auth/dto/login-user.dto';
import { ActivityFilterDto, GetBroadcastReportDto, GetReportDto } from './dto/get-report.dto';
import { ApiListResponseDto } from '@/common/dto/api-list-response.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: ReportService,
  ) {
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("/dashboard")
  async getContacts(
    @Request() req: { user: LoginUser },
    @Query() query: GetReportDto
  ) {
    return this.reportService.getDashboard(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("/broadcast-analytics")
  async getBroadcastAnalytics(
    @Request() req: { user: LoginUser },
    @Query() query: GetBroadcastReportDto
  ) {
    return this.reportService.getBroadcastReport(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("activity-log")
  async getActivities(
    @Request() req: { user: LoginUser },
    @Query() query: ActivityFilterDto
  ): Promise<ApiListResponseDto<any>> {
    return this.reportService.getActivities(req.user, query);
  }
}