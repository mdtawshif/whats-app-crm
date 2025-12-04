import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UsePipes, ValidationPipe, UseGuards, Req } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto, UpdateConversationDto, ConversationQueryDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guard/auth.guard';
import type { LoginUser } from '../auth/dto/login-user.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationMessagesQueryDto } from './dto/conversation-messages-query.dto';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) { }

  //send message
  @ApiOperation({ summary: 'Send a message to a contact' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @Post('send-message')
  sendMessage(@Req() req: { user: LoginUser }, @Body() messageData: SendMessageDto) {
    return this.conversationService.sendMessage(req.user, messageData);
  }



  @Get(':contactId/messages')
  @ApiOperation({ summary: 'Get paginated messages for a conversation (by contact)' })
  @ApiQuery({ name: 'query', required: false, description: 'Search term for message content' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'CLOSED'], description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Paginated messages' })
  async getConversationMessages(
    @Param('contactId') contactId: string,
    @Query() query: ConversationMessagesQueryDto,
    @Req() req: { user: LoginUser },
  ) {
    return this.conversationService.getConversationMessages(contactId, req.user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string) {
    return this.conversationService.getConversation(id);
  }

  @Post()
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  async createConversation(@Body() createConversationDto: CreateConversationDto) {
    return this.conversationService.createConversation(createConversationDto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation updated' })
  async updateConversation(@Param('id') id: string, @Body() updateConversationDto: UpdateConversationDto) {
    return this.conversationService.updateConversation(id, updateConversationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  async deleteConversation(@Param('id') id: string) {
    return this.conversationService.deleteConversation(id);
  }
}