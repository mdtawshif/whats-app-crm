import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UsePipes, ValidationPipe, Req, UseGuards } from '@nestjs/common';
import { InboxThreadService } from './inbox-thread.service';
import { CreateInboxThreadDto, UpdateInboxThreadDto, InboxThreadQueryDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import type { LoginUser } from '../auth/dto/login-user.dto';
import { AuthGuard } from '@/common/guard/auth.guard';
import  { CheckIsInboxThreadExistsDto } from './dto/check-inbox-thread.dto';

@ApiTags('Inbox Threads')
@Controller('inbox-threads')
@UseGuards(AuthGuard)
export class InboxThreadController {
  constructor(private readonly inboxThreadService: InboxThreadService) { }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated inbox threads with optional filters' })
  @ApiQuery({ name: 'query', required: false, description: 'Search term for message content or from/to' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'CLOSED', 'PENDING'] })
  @ApiQuery({ name: 'isRead', required: false, enum: ['READ', 'UNREAD'] })
  @ApiResponse({ status: 200, description: 'List of inbox threads' })
  async getInboxThreads(@Query() query: InboxThreadQueryDto, @Req() req: { user: LoginUser }) {
    return this.inboxThreadService.getInboxThreads(req.user, query);
  }



  @Post('check-is-inbox-thread-exists')
  @ApiOperation({ summary: 'Check if an inbox thread exists' })
  @ApiResponse({ status: 200, description: 'Inbox thread exists' })
  @ApiResponse({ status: 404, description: 'Inbox thread not found' })
  async checkIsInboxThreadExists(@Body() dto: CheckIsInboxThreadExistsDto, @Req() req: { user: LoginUser }) {
    return this.inboxThreadService.checkIsInboxThreadExists(req.user, dto);
  }


  @Get('single/:id')
  @ApiOperation({ summary: 'Get an inbox thread by ID' })
  @ApiResponse({ status: 200, description: 'Inbox thread details' })
  @ApiResponse({ status: 404, description: 'Inbox thread not found' })
  async getInboxThread(@Param('id') id: string) {
    return this.inboxThreadService.getInboxThread(id);
  }

 


  @Post()
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Create a new inbox thread' })
  @ApiResponse({ status: 201, description: 'Inbox thread created' })
  async createInboxThread(@Body() createInboxThreadDto: CreateInboxThreadDto) {
    return this.inboxThreadService.createInboxThread(createInboxThreadDto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Update an inbox thread' })
  @ApiResponse({ status: 200, description: 'Inbox thread updated' })
  async updateInboxThread(@Param('id') id: string, @Body() updateInboxThreadDto: UpdateInboxThreadDto) {
    return this.inboxThreadService.updateInboxThread(id, updateInboxThreadDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an inbox thread' })
  @ApiResponse({ status: 204, description: 'Inbox thread deleted' })
  async deleteInboxThread(@Param('id') id: string, @Req() req: { user: LoginUser }) {

    return this.inboxThreadService.deleteInboxThread(req.user.agencyId, id);
  }
}