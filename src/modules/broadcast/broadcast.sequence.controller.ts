// broadcasts-sequences.controller.ts
import {
    Body, Controller, Post, Put, Get, Delete,
    Param, ParseIntPipe, Request, UseGuards, BadRequestException,
    Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BroadcastService } from './broadcast.service';
import { LoginUser } from '../auth/dto/login-user.dto';
import { AuthGuard } from '@/common/guard/auth.guard';
import { PermissionGuard } from '@/common/guard/permission-guard';
import { RequirePermission } from '@/common/decorator/require-permission.decorator';
import { AssetDTO } from '@/utils/AssetDTO';
import { PermissionDTO } from '@/utils/PermissionDTO';
import {
    CreateSequenceDto, UpdateSequenceDto, BroadcastSequenceResponseDto
} from './dto/create-sequence.dto';
import { ApiCreateResponseDto } from '../../common/dto/api-create-response.dto';
import { ApiUpdateResponseDto } from '../../common/dto/api-update-response.dto';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { ApiDeleteResponseDto } from '../../common/dto/api-delete-response.dto';
import { BroadcastSettingDetailResponse, BroadcastSettingDetailStatus, BroadcastSettingStatsDTO } from './dto/broadcast.sequence.stats.dto';
import { PaginationInfo } from '@/common/helpers/pagination.info';

@ApiTags('Broadcasts > Sequences')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission(
    AssetDTO.ofName(AssetDTO.BROADCASTS),
    PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
)
@Controller('broadcasts/:broadcastId/sequences')
export class BroadcastSequencesController {
    constructor(private readonly broadcastService: BroadcastService) { }

    @Post()
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME),
    )
    async createSequence(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Body() dto: CreateSequenceDto,
        @Request() req: { user: LoginUser },
    ): Promise<ApiCreateResponseDto<BroadcastSequenceResponseDto>> {
        return this.broadcastService.createSequence(req.user, dto, broadcastId);
    }

    @Put(':sequenceId')
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
    )
    @ApiParam({ name: 'sequenceId', type: Number, example: 34 })
    async updateSequence(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Param('sequenceId', ParseIntPipe) sequenceId: number,
        @Body() dto: UpdateSequenceDto,
        @Request() req: { user: LoginUser },
    ): Promise<ApiUpdateResponseDto<BroadcastSequenceResponseDto>> {
        // (Optional) ensure dto.id matches path if your DTO includes id
        // if (dto.id && dto.id !== sequenceId) throw new BadRequestException('sequenceId mismatch');
        return this.broadcastService.updateSequence(req.user, broadcastId, sequenceId, dto);
    }

    @Get()
    async listSequences(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Request() req: { user: LoginUser },
    ): Promise<ApiListResponseDto<BroadcastSequenceResponseDto>> {
        return this.broadcastService.getSequences(req.user, broadcastId);
    }

    @Delete(':sequenceId')
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME),
    )
    async deleteSequence(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Param('sequenceId', ParseIntPipe) sequenceId: number,
        @Request() req: { user: LoginUser },
    ): Promise<ApiDeleteResponseDto> {
        return this.broadcastService.deleteSequence(req.user, broadcastId, sequenceId);
    }
    

  @Get('/sequence-stats')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.BROADCASTS),
    PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
  )
  @ApiOperation({ summary: "Get broadcast sequence statistics for a broadcast" })
  async getBroadcastSequenceStats(
    @Param('broadcastId', ParseIntPipe) broadcastId: number,
    @Request() req: { user: LoginUser }) {
    
    const broadcastSequenceQueueStatsDTO : BroadcastSettingStatsDTO [] = await this.broadcastService.getBroadcastSequenceQueueStats(broadcastId);
    return {
      'sequenceStats':  broadcastSequenceQueueStatsDTO
    }
  }

  @Get(':sequenceId/details')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
    )
    @ApiParam({ name: 'sequenceId', type: Number, })
    @ApiQuery({ name: 'searchKey', type: String, required: false, example: '' }) 
    async getSettingsStatsDetails(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Param('sequenceId', ParseIntPipe) sequenceId: number,
        @Request() req: { user: LoginUser },
        @Query('status') status: string,
        @Query('currentPage') currentPage?: number,
        @Query('perPage') perPage?: number,
        @Query('searchKey') searchKey?: string,
    ): Promise<{
        pagination:PaginationInfo,
        data: BroadcastSettingDetailResponse[];}>{
        
        const request = {
            status: status,
            currentPage: currentPage ? currentPage : 1,
            perPage : perPage ? perPage : 20,
            searchKey : searchKey ? searchKey : undefined
        }
        const result = await this.broadcastService.getBroadcastSettingDetails(broadcastId, sequenceId, request);
        const pagination = new PaginationInfo(Number(result.total), currentPage, perPage);
        return {
          pagination,
          data: result.data
        }
    }
}
