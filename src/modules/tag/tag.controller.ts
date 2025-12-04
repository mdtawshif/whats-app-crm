import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TagService } from "./tag.service";
import { CreateTagDto, TagListItemDto, TagListParamDto, UpdateTagDto } from "./dto/create-tag.dto";
import { AuthGuard } from "@/common/guard/auth.guard";
import { LoginUser } from "../auth/dto/login-user.dto";
import { PermissionGuard } from '../../common/guard/permission-guard';
import { AssetDTO } from '../../utils/AssetDTO';
import { PermissionDTO } from '../../utils/PermissionDTO';
import { RequirePermission } from '../../common/decorator/require-permission.decorator';
import { ApiListResponseDto } from "@/common/dto/api-list-response.dto";


@ApiTags("Tag")
@Controller("tag")
export class TagController {
  constructor(readonly tagService: TagService) { }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @Post('create-tag')
  @RequirePermission(AssetDTO.of(0n, AssetDTO.TAGS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
  async createTag(
    @Request() req: { user: LoginUser },
    @Body() dto: CreateTagDto
  ) {
    return this.tagService.createTag(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @Get('list')
  @RequirePermission(AssetDTO.of(0n, AssetDTO.TAGS), PermissionDTO.of(PermissionDTO.VIEW_PERMISSION_VALUE, PermissionDTO.VIEW_PERMISSION_NAME))
  async getTags(
    @Request() req: { user: LoginUser },
    @Query() query: TagListParamDto): Promise<ApiListResponseDto<TagListItemDto>> {
    const user: LoginUser = req.user;
    return this.tagService.getTags(user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @Put('update-tag/:id')
  @RequirePermission(AssetDTO.of(0n, AssetDTO.TAGS), PermissionDTO.of(PermissionDTO.EDIT_PERMISSION_VALUE, PermissionDTO.EDIT_PERMISSION_NAME))
  async updateTag(
    @Request() req: { user: LoginUser },
    @Body() dto: UpdateTagDto,
    @Param('id') id: number
  ) {
    return this.tagService.updateTag(req.user, dto, BigInt(id));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @Delete('delete-tag/:id')
  @RequirePermission(AssetDTO.of(0n, AssetDTO.TAGS), PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME))
  async deleteTag(@Request() req: { user: LoginUser }, @Param('id') id: number) {
    return this.tagService.deleteTag(req.user, BigInt(id));
  }

}
