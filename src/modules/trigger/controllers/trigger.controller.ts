import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { TriggerService } from '../services/core/trigger.service';
import { TriggerEventService } from '../services/core/trigger-event.service';
import { TriggerActionService } from '../services/core/trigger-action.service';
import { CreateTriggerDto } from '../dto/create-trigger.dto';
import { UpdateTriggerDto } from '../dto/update-trigger.dto';
import { CreateTriggerEventDto } from '../dto/create-trigger-event.dto';
import { UpdateTriggerEventDto } from '../dto/update-trigger-event.dto';
import { CreateTriggerActionDto } from '../dto/create-trigger-action.dto';
import { UpdateTriggerActionDto } from '../dto/update-trigger-action.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guard/auth.guard';
import { CommonGetTriggerDto } from '../dto/common-get-trigger.dto';
import { LoginUser } from '../../auth/dto/login-user.dto';
import { UpdateTriggerWithConfigsDto } from '../dto/update-trigger-with-configs.dto';
import { RoleDTO } from '@/utils/RoleDTO';
import { RestrictToRoles } from '@/common/decorator/restrict-to-roles.decorator';

@ApiTags('triggers')
@Controller('triggers')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TriggerController {
  constructor(
    private readonly triggerService: TriggerService,
    private readonly eventService: TriggerEventService,
    private readonly actionService: TriggerActionService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new trigger' })
  @ApiResponse({ status: 201, description: 'Trigger created' })
  create(@Body() createTriggerDto: CreateTriggerDto, @Req() req: { user: LoginUser }) {
    return this.triggerService.create(createTriggerDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all triggers with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'PAUSED'] })
  findAll(@Query() query: CommonGetTriggerDto, @Req() req: { user: LoginUser }) {
    return this.triggerService.findAll(query, req.user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get trigger by ID" })
  async findOne(@Req() req: { user: LoginUser }, @Param("id", ParseIntPipe) id: bigint, @Query("eventKey") eventKey?: string) {
    const res = await this.triggerService.findOne(id, req.user, eventKey);
    console.log({ res });
    return res;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update trigger' })
  update(@Param('id', ParseIntPipe) id: bigint, @Body() updateTriggerDto: UpdateTriggerDto, @Req() req: { user: LoginUser }) {
    return this.triggerService.update(id,updateTriggerDto, req.user);
  }

  @Patch(':id/configs')
  @ApiOperation({ summary: 'Update trigger with event and action configurations' })
  @ApiResponse({ status: 200, description: 'Trigger updated with configurations' })
  updateTriggerWithConfigs(
    @Param('id', ParseIntPipe) id: bigint,
    @Body() updateTriggerWithConfigsDto: UpdateTriggerWithConfigsDto,
    @Req() req: { user: LoginUser }
  ) {
    return this.triggerService.updateTriggerWithConfigs(id, updateTriggerWithConfigsDto, req.user);
  }

  @Delete(':id/configs')
  @ApiOperation({ summary: 'Remove all event and action configurations for a trigger' })
  @ApiResponse({ status: 200, description: 'Trigger configurations deleted successfully' })
  async removeTriggerConfigs(
    @Param('id', ParseIntPipe) id: bigint,
    @Req() req: { user: LoginUser },
  ) {
    return this.triggerService.removeTriggerConfigs(id, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete trigger' })
  remove(@Param('id', ParseIntPipe) id: bigint, @Req() req: { user: LoginUser }) {
    return this.triggerService.remove(id, req.user);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate trigger' })
  duplicate(@Param('id', ParseIntPipe) id: bigint, @Req() req: { user: LoginUser }) {
    return this.triggerService.duplicate(id, req.user);
  }

  @Post(':id/events')
  @ApiOperation({ summary: 'Assign events to trigger' })
  assignEvents(
    @Req() req: { user: LoginUser },
    @Param('id', ParseIntPipe) id: bigint,
    @Body('eventIds') eventIds: bigint[],
    @Body('configs') configs?: any[],
  ) {
    return this.triggerService.assignEvents(id, eventIds, configs, req.user);
  }

  @Post(':id/actions/:triggerEventConfigId')
  @ApiOperation({ summary: 'Assign actions to trigger' })
  assignActions(
    @Req() req: { user: LoginUser },
    @Param('id', ParseIntPipe) id: bigint,
    @Param('triggerEventConfigId', ParseIntPipe) triggerEventConfigId: bigint,
    @Body('actionIds') actionIds: bigint[],
    @Body('configs') configs?: any[],
  ) {
    return this.triggerService.assignActions(id, triggerEventConfigId, actionIds, configs, req.user);
  }

  @Post(':id/event-configs')
  @ApiOperation({ summary: 'Add event configuration to trigger' })
  addEventConfig(
    @Param('id', ParseIntPipe) id: bigint,
    @Body() body: { eventId: bigint; filters?: any; configs?: any },
    @Req() req: { user: LoginUser }
  ) {
    return this.triggerService.addEventConfig(id, body.eventId, body.filters, body.configs, req.user);
  }

  @Patch('event-configs/:configId')
  @ApiOperation({ summary: 'Update event configuration' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  updateEventConfig(
    @Param('configId', ParseIntPipe) configId: bigint,
    @Body() body: { filters?: any; configs?: any },
    @Req() req: { user: LoginUser }
  ) {
    return this.triggerService.updateEventConfig(configId, body.filters, body.configs, req.user);
  }

  @Delete('event-configs/:configId')
  @ApiOperation({ summary: 'Remove event configuration' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  removeEventConfig(@Param('configId', ParseIntPipe) configId: bigint) {
    return this.triggerService.removeEventConfig(configId);
  }

  @Post(':id/action-configs')
  @ApiOperation({ summary: 'Add action configuration to trigger' })
  addActionConfig(
    @Param('id', ParseIntPipe) id: bigint,
    @Body() body: { actionId: bigint; eventConfigId?: bigint; configs?: any },
    @Req() req: { user: LoginUser }
  ) {
    return this.triggerService.addActionConfig(id, body.actionId, body.eventConfigId || null, body.configs, req.user);
  }

  @Patch('action-configs/:configId')
  @ApiOperation({ summary: 'Update action configuration' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  updateActionConfig(
    @Param('configId', ParseIntPipe) configId: bigint,
    @Body() body: { configs?: any },
    @Req() req: { user: LoginUser }
  ) {
    return this.triggerService.updateActionConfig(configId, body.configs, req.user);
  }

  @Delete('action-configs/:configId')
  @ApiOperation({ summary: 'Remove action configuration' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  removeActionConfig(@Param('configId', ParseIntPipe) configId: bigint) {
    return this.triggerService.removeActionConfig(configId);
  }

  // Event endpoints (Super Admin only)
  @Post('events')
  @ApiOperation({ summary: 'Create event' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  createEvent(@Body() dto: CreateTriggerEventDto) {
    return this.eventService.create(dto);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get all events' })
  findAllEvents(@Query() query: CommonGetTriggerDto) {
    return this.eventService.findAll(query);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get event by ID' })
  findOneEvent(@Param('id', ParseIntPipe) id: bigint) {
    return this.eventService.findOne(id);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Update event' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  updateEvent(@Param('id', ParseIntPipe) id: bigint, @Body() dto: UpdateTriggerEventDto) {
    return this.eventService.update(id, dto);
  }

  @Delete('events/:id')
  @ApiOperation({ summary: 'Delete event' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  removeEvent(@Param('id', ParseIntPipe) id: bigint) {
    return this.eventService.remove(id);
  }

  // Action endpoints (Super Admin only)
  @Post('actions')
  @ApiOperation({ summary: 'Create action' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  createAction(@Body() dto: CreateTriggerActionDto) {
    return this.actionService.create(dto);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Get all actions' })
  findAllActions(@Query() query: CommonGetTriggerDto) {
    return this.actionService.findAll(query);
  }

  @Get('actions/:id')
  @ApiOperation({ summary: 'Get action by ID' })
  findOneAction(@Param('id', ParseIntPipe) id: bigint) {
    return this.actionService.findOne(id);
  }

  @Patch('actions/:id')
  @ApiOperation({ summary: 'Update action' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  updateAction(@Param('id', ParseIntPipe) id: bigint, @Body() dto: UpdateTriggerActionDto) {
    return this.actionService.update(id, dto);
  }

  @Delete('actions/:id')
  @ApiOperation({ summary: 'Delete action' })
  @RestrictToRoles(RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  removeAction(@Param('id', ParseIntPipe) id: bigint) {
    return this.actionService.remove(id);
  }
}