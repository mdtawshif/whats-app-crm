import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { LoginUser } from "../auth/dto/login-user.dto";
import { AuthGuard } from "@/common/guard/auth.guard";
import { BroadcastService } from "./broadcast.service";
import { CreateBroadcastDto } from "./dto/create-broadcast.dto";
import { RequirePermission } from "@/common/decorator/require-permission.decorator";
import { AssetDTO } from "@/utils/AssetDTO";
import { PermissionDTO } from "@/utils/PermissionDTO";
import { PermissionGuard } from '../../common/guard/permission-guard';
import { Query, BadRequestException } from '@nestjs/common';
import { BroadCastListParamDto, BroadcastListItemDto } from './dto/list-broadcast.dto';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { ApiDeleteResponseDto } from '../../common/dto/api-delete-response.dto';
import { ApiUpdateResponseDto } from '../../common/dto/api-update-response.dto';
import { ApiCreateResponseDto } from '../../common/dto/api-create-response.dto';
import { UpdateBroadcastDto } from './dto/edit-broadcast.dto';
import { ApiViewResponseDto } from '../../common/dto/api-view-response.dto';
import { BroadcastResponseDto, UnsubscribeContactsDto, AddBroadcastContactsDto, BroadcastContactListParamDto, BroadcastContactListItemDto, BroadcastAction, ChangeBroadcastBodyDto, BroadcastStatsResponseDTO } from './dto/broadcast.dto';
import { PinoLogger } from "nestjs-pino";

@ApiTags("Broadcasts")
@Controller("broadcasts")
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService,
    private readonly logger: PinoLogger
  ) { }

  // Create broadcast
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.BROADCASTS), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  @Post("create")
  async create(@Request() req: { user: LoginUser }, @Body() dto: CreateBroadcastDto): Promise<ApiCreateResponseDto<BroadcastResponseDto>> {
    const user: LoginUser = req.user;
    console.log('CreateBroadcastDto', dto);
    return this.broadcastService.createBroadcast(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.BROADCASTS), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  @Get('get/:id')
  async getBroadcast(
    @Request() req: { user: LoginUser },
    @Param('id', ParseIntPipe) id: number
  ): Promise<ApiViewResponseDto<BroadcastResponseDto>> {
    console.log('id', id);
    return this.broadcastService.getBroadcast(req.user, id);
  }

  // Get all broadcasts of logged-in user
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.BROADCASTS), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  @Get("list")
  async findAll(@Request() req: { user: LoginUser },
    @Query() query: BroadCastListParamDto): Promise<ApiListResponseDto<BroadcastListItemDto>> {
    const user: LoginUser = req.user;
    return this.broadcastService.getBroadcasts(user, query);
  }

  // Update broadcast
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.BROADCASTS), PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME))
  @Put('update')
  async update(
    @Request() req: { user: LoginUser },
    @Body() dto: UpdateBroadcastDto,
  ): Promise<ApiUpdateResponseDto<BroadcastResponseDto>> {
    return this.broadcastService.updateBroadcast(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.BROADCASTS), PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME))
  @Delete('delete/:id')
  async remove(
    @Request() req: { user: LoginUser },
    @Param('id', ParseIntPipe) id: number
  ): Promise<ApiDeleteResponseDto> {
    console.log('id', id);
    return this.broadcastService.deleteBroadcast(req.user, id);
  }

  @Patch(':broadcastId/action')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.BROADCASTS),
    PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
  )
  @ApiOperation({ summary: 'Pause, resume, stop, or delete a broadcast' })
  async changeStatus(
    @Param('broadcastId', ParseIntPipe) broadcastId: number,
    @Body() body: ChangeBroadcastBodyDto,
    @Request() req: { user: LoginUser }
  ) {
    switch (body.action) {
      case BroadcastAction.PAUSE:
        return await this.broadcastService.pause(broadcastId, req.user, body);
      case BroadcastAction.RESUME:
        return await this.broadcastService.resume(broadcastId, req.user, body);
      case BroadcastAction.STOP:
        return await this.broadcastService.stop(broadcastId, req.user, body);
      case BroadcastAction.DELETE:
        return await this.broadcastService.delete(broadcastId, req.user, body);
      default:
        throw new BadRequestException('Invalid broadcast action');
    }
  }

  /**
   * @apit to fetch broadcast stats
   * @param userId 
   * @returns 
   */
  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.BROADCASTS),
    PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
  )

  @ApiOperation({ summary: "Get broadcast statistics for a user" })
  async getBroadcastStats(@Request() req: { user: LoginUser }): Promise<BroadcastStatsResponseDTO> {
    const broadcastStatsResponse: BroadcastStatsResponseDTO = await this.broadcastService.getBroadcastStats(req.user.id);
    return broadcastStatsResponse;
  }
}
