import { Controller, Get, Post, Patch, Query, Param, Body, Request, UseGuards, Redirect, BadRequestException, NotFoundException, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guard/auth.guard';
import { IntegrationsService } from './integrations.service';
import { SelectSheetDto } from './dto/select-sheet.dto';
import { getApiConfig } from '@/config/config.utils';
import { ConfigService } from '@nestjs/config';
import { GenerateCsvUrlDto, GoogleSheetListResponseDto, GoogleSheetQueryDto } from './dto/index.dto';
import { IntegrationType } from '@prisma/client';
import type { LoginUser } from '../auth/dto/login-user.dto';
import { GoogleSheetMetadataResponseDto } from './dto/google-sheet-metadata.dto';
import { BasePaginationDto } from '@/common/dto/base-pagination.dto';


@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) { }

  @Get('google-contact-or-sheet/auth/:type')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Returns Google Integration auth URL' })
  async getGoogleAuthUrl(
    @Request() req: { user: LoginUser },
    @Param('type') type: string,
  ) {
    const userId = req.user.id;

    let integrationType: IntegrationType;
    if (type === 'sheets') {
      integrationType = IntegrationType.GOOGLE_SHEETS;
    } else if (type === 'contact') {
      integrationType = IntegrationType.GOOGLE_CONTACT;
    } else {
      throw new BadRequestException('Invalid integration type');
    }

    const url = await this.integrationsService.getGoogleAuthUrl(userId, integrationType);
    return { url };
  }

  // @Get('google-sheets/auth')
  // @ApiBearerAuth()
  // @UseGuards(AuthGuard)
  // @ApiResponse({ status: 200, description: 'Returns Google Sheets auth URL' })
  // async connectGoogleSheets(@Request() req: { user: LoginUser }) {
  //   const url = await this.integrationsService.getGoogleAuthUrl(req.user.id);
  //   return { url };
  // }

  // @Get('google-contact/auth')
  // @ApiBearerAuth()
  // @UseGuards(AuthGuard)
  // @ApiResponse({ description: 'Get Google OAuth URL for Contacts' })
  // async getAuthUrl(@Request() req: { user: LoginUser }) {
  //   const userId = req.user.id;
  //   const url = await this.integrationsService.getGoogleAuthUrl(
  //     userId,
  //     IntegrationType.GOOGLE_CONTACT,
  //   );
  //   return { url };
  // }

  @Get('google-sheets/callback')
  @Redirect()
  @ApiResponse({ status: 302, description: 'Handles Google Sheets OAuth callback and redirects' })
  async handleGoogleSheetsCallback(@Query('code') code: string, @Query('state') state: string, @Query('error') error?: string) {
    const apiConfig = getApiConfig(this.configService);
    // 🔹 Handle cancel or auth errors first
    if (error) {
      return {
        url: `${apiConfig.clientBaseUrl}/import-contacts/google-sheets?error=${encodeURIComponent(error)}`,
      };
    }

    if (!code) {
      return {
        url: `${apiConfig.clientBaseUrl}/import-contacts/google-sheets?error=missing_code`,
      };
    }
    return this.integrationsService.handleGoogleCallback(code, state, apiConfig.clientBaseUrl);
  }

  @Get('google-sheets/list/:integrationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page', example: '10' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by sheet name', example: 'Sheet Name' })
  @ApiResponse({ status: 200, type: GoogleSheetListResponseDto })
  async listSheets(@Request() req: { user: LoginUser }, @Param('integrationId') integrationId: bigint, @Query() query: GoogleSheetQueryDto) {
    return this.integrationsService.listUserSheets(req.user.id, integrationId, query);
  }

  @Get('google-sheets/:sheetId/metadata/:integrationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, type: GoogleSheetMetadataResponseDto, description: 'Returns metadata for the specified Google Sheet' })
  async getSheetMetadata(
    @Request() req: { user: LoginUser },
    @Param('sheetId') sheetId: string,
    @Param('integrationId') integrationId: bigint,
  ) {
    if (!sheetId) {
      throw new BadRequestException('Sheet ID is required');
    }
    return this.integrationsService.getGoogleSheetMetadata(req.user.id, integrationId, sheetId);
  }

  @Post('google-sheets/csv-url')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiBody({ type: GenerateCsvUrlDto })
  @ApiResponse({ status: 200, description: 'Returns a public CSV download URL for the Google Sheet' })
  async generateGoogleSheetCsvUrl(@Request() req: { user: LoginUser }, @Body() body: GenerateCsvUrlDto) {
    return this.integrationsService.generateGoogleSheetCsvContent(req.user.id, body.input, body.integrationId);
  }



  @Get('user-connection-status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Returns connection status for user integrations' })
  async getConnectionStatus(@Request() req: { user: LoginUser }) {
    return this.integrationsService.getUserConnectionStatus(req.user);
  }


  @Get('user')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by integration type', example: 'GOOGLE_SHEETS' })
  @ApiResponse({ status: 200, description: 'Returns all user integrations, optionally filtered by type' })
  async getUserIntegrations(
    @Request() req: { user: LoginUser },
    @Query('type') type?: IntegrationType,
  ) {
    if (type && !Object.values(IntegrationType).includes(type)) {
      throw new BadRequestException(`Invalid integration type: ${type}`);
    }
    const integrations = await this.integrationsService.getUserIntegrations(
      req.user.id,
      req.user.agencyId,
      type,
    );
    return { integrations };
  }



  @Get('user/:type/:integrationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Returns the user integration for the specified type' })
  async getUserIntegration(
    @Request() req: { user: LoginUser },
    @Param('type') type: IntegrationType,
    @Param('integrationId') integrationId: bigint,
  ) {
    if (!Object.values(IntegrationType).includes(type)) {
      throw new BadRequestException(`Invalid integration type: ${type}`);
    }
    const integration = await this.integrationsService.getUserIntegration(
      req.user,
      integrationId,
      type,
    );
    if (!integration) {
      throw new NotFoundException(`No active ${type} integration found`);
      // return null;
    }
    return integration;
  }

  @Patch(':id/select-sheet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Selects a specific Google Sheet for the integration' })
  async selectSheet(
    @Param('id') id: string,
    @Body() dto: SelectSheetDto,
    @Request() req: { user: LoginUser },
  ) {
    return this.integrationsService.selectSheet(req.user.id, BigInt(id), dto);
  }

  @Delete('disconnect/:type/:integrationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Disconnects the specified integration type for the user' })
  async disconnectIntegration(
    @Param('type') type: IntegrationType,
    @Param('integrationId') integrationId: bigint,
    @Request() req: { user: LoginUser },
  ) {
    if (!Object.values(IntegrationType).includes(type)) {
      throw new BadRequestException(`Invalid integration type: ${type}`);
    }
    return this.integrationsService.disconnectService(req.user.id, integrationId, type);
  }

  // @Get('google-contact/auth')
  // @ApiBearerAuth()
  // @UseGuards(AuthGuard)
  // @ApiResponse({ description: 'Get Google OAuth URL for Contacts' })
  // async getAuthUrl(@Request() req: { user: LoginUser }) {
  //   const userId = req.user.id;
  //   const url = await this.integrationsService.getGoogleAuthUrl(
  //     userId,
  //     IntegrationType.GOOGLE_CONTACT,
  //   );
  //   return { url };
  // }


  @Get('google-contacts/callback')
  @Redirect()
  @ApiResponse({ description: 'Handle Google OAuth callback for Contacts' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    console.log("code", code)
    console.log("state", state)
    if (!code || !state) {
      throw new NotFoundException('Missing code, state, or clientBaseUrl');
    }

    const apiConfig = getApiConfig(this.configService);
    const clientBaseUrl = apiConfig.clientBaseUrl;

    if (!clientBaseUrl) {
      throw new NotFoundException('Missing clientBaseUrl');
    }

    const redirect = await this.integrationsService.handleGoogleCallback(
      code,
      state,
      clientBaseUrl,
    );


    console.log("redirect", redirect)

    return redirect;
  }

  @Post('google-contacts/import-request')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ description: 'Queue Google Contacts import request' })
  async createGoogleContactsImportRequest(@Request() req: { user: LoginUser }, @Body() body: { integrationId: bigint }) {

    //
    const result = await this.integrationsService.queueGoogleContactsImport(req.user, body?.integrationId);
    return result;
  }

  // @Post('google-contacts/import')
  // @ApiBearerAuth()
  // @UseGuards(AuthGuard)
  // @ApiResponse({ description: 'Import Google Contacts into system' })
  // async importContacts(@Request() req: { user: LoginUser }) {
  //   const userId = req.user.id;
  //   const agencyId = req.user.agencyId;

  //   const result = await this.integrationsService.importGoogleContacts(
  //     userId,
  //     agencyId,
  //   );
  //   return result;
  // }

  @Get('google-contacts/fetch/:integrationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ description: 'Fetch Google Contacts from Google API' })
  async fetchContacts(
    @Request() req: { user: LoginUser },
    @Query() query: BasePaginationDto,
    @Param('integrationId') integrationId: bigint,
  ) {
    const userId = req.user.id;
    const agencyId = req.user.agencyId;

    console.log("query", query)

    const integration = await this.integrationsService.getUserIntegration(
      req.user,
      integrationId,
      IntegrationType.GOOGLE_CONTACT,
    );

    if (!integration) {
      throw new NotFoundException('No Google Contacts integration found');
    }

    const contacts = await this.integrationsService.fetchGoogleContacts(
      integration.accessToken,
      query
    );

    return contacts;
  }

  @Delete('google-contacts/disconnect/:integrationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ description: 'Disconnect Google Contacts integration' })
  async disconnect(@Request() req: { user: LoginUser }, @Param('integrationId') integrationId: bigint) {
    const userId = req.user.id;
    const result = await this.integrationsService.disconnectService(
      userId,
      integrationId,
      IntegrationType.GOOGLE_CONTACT,
    );
    return result;
  }

  /**
   * List all integrations for user (optional, can be used to check multiple Google accounts)
   */
  @Get('google-contacts/integrations')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiResponse({ description: 'Get all active Google Contacts integrations for user' })
  async getIntegrations(@Request() req: { user: LoginUser }) {
    const userId = req.user.id;
    const agencyId = req.user.agencyId;

    const integrations = await this.integrationsService.getUserIntegrations(
      userId,
      agencyId,
      IntegrationType.GOOGLE_CONTACT,
    );
    return integrations;
  }
}