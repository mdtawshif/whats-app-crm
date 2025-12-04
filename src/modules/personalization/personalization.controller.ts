import { Controller, Get, Post, Body, Param, Delete, UseGuards, Put, Request, ParseIntPipe, Query } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';
import { CreatePersonalizationDto } from './dto/create-personalization.dto';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guard/auth.guard';
import { PermissionGuard } from '../../common/guard/permission-guard';
import { RequirePermission } from '@/common/decorator/require-permission.decorator';
import { AssetDTO } from '../../utils/AssetDTO';
import { PermissionDTO } from '../../utils/PermissionDTO';
import { ApiDeleteResponseDto } from '../../common/dto/api-delete-response.dto';
import { ApiUpdateResponseDto } from '../../common/dto/api-update-response.dto';
import { ApiViewResponseDto } from '../../common/dto/api-view-response.dto';
import { PersonalizationDto } from './dto/personalization.dto';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { PersonalizationListItemDto, PersonalizationListParamDto, PersonalizationItemDto } from './dto/personalization.listitem.dto';
import { ApiCreateResponseDto } from '@/common/dto/api-create-response.dto';
import { LoginUser } from '../auth/dto/login-user.dto';

@ApiTags("Personalizations")
@Controller('personalizations')
export class PersonalizationController {
  constructor(private readonly personalizationService: PersonalizationService) { }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  @Post()
  create(@Request() req: { user: LoginUser }, @Body() createPersonalizationDto: CreatePersonalizationDto): Promise<ApiCreateResponseDto<PersonalizationDto>> {
    return this.personalizationService.create(req.user, createPersonalizationDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  @Get()
  findAll(@Request() req: { user: LoginUser },
    @Query() query: PersonalizationListParamDto): Promise<ApiListResponseDto<PersonalizationListItemDto>> {
    console.log(req.user);
    console.log(query);
    return this.personalizationService.findAll(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  @Get(':id')
  findOne(@Request() req: { user: LoginUser }, @Param('id', ParseIntPipe) id: number): Promise<ApiViewResponseDto<PersonalizationDto>> {
    return this.personalizationService.findOne(req.user, id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME))
  @Put(':id')
  update(@Request() req: { user: LoginUser }, @Param('id', ParseIntPipe) id: number, @Body() updatePersonalizationDto: UpdatePersonalizationDto): Promise<ApiUpdateResponseDto<UpdatePersonalizationDto>> {
    return this.personalizationService.update(req.user, id, updatePersonalizationDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME))
  @Delete(':id')
  remove(@Request() req: { user: LoginUser },
    @Param('id', ParseIntPipe) id: number): Promise<ApiDeleteResponseDto> {
    return this.personalizationService.remove(req.user, id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  @Get('list')
  find(@Request() req: { user: LoginUser }): Promise<ApiListResponseDto<PersonalizationItemDto>> {
    console.log(req.user);
    return this.personalizationService.findList(req.user);
  }


}
