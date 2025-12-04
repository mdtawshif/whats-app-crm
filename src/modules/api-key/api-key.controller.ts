import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Req, Get } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guard/auth.guard';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';
import type { LoginUser } from '../auth/dto/login-user.dto';

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) { }

  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Generate a new API key for a user' })
  @ApiResponse({ status: 201, description: 'API key successfully generated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createApiKeyDto: CreateApiKeyDto, @Req() req: { user: LoginUser }) {
    return await this.apiKeyService.generateApiKey(createApiKeyDto.userId);
  }
  
}