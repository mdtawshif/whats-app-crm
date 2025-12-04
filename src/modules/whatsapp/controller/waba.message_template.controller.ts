import { AuthGuard } from '@/common/guard/auth.guard';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AddTemplateDto, GetAllDto, GetAllShortDto, TemplateCreationDto } from '../dto/wa.message.template.dto';
import { MessageTemplateService } from '../service/wa.message.template.service';
import { returnError, returnSuccess } from '@/common/helpers/response-handler.helper';
import { HttpStatusCode } from 'axios';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { ALLOWED_META_MIME_TYPES, createMessageTemplate, createWhatsAppMessageTemplate, uploadMetaImage } from '@/common/wa-helper/wa-helper';
import { MetaOAuthTokenService } from '../service/meta.oauth.token.service';
import { FastifyRequestWithUser, MetaLanguageCode } from '@/common/wa-helper/interface.dt';
import { PermissionGuard } from '@/common/guard/permission-guard';
import { RequirePermission } from '@/common/decorator/require-permission.decorator';
import { AssetDTO } from '@/utils/AssetDTO';
import { PermissionDTO } from '@/utils/PermissionDTO';
import { WaHelperService } from '../service/wa-helper.service';
import { GatewayCredentialService } from 'src/modules/gateway-provider/gateway.credential.service';
import { GatewayCredentialGatewayType } from '@prisma/client';

@Controller('wa-message-templates')
@ApiTags('Whats App MessageTemplate')
export class WabaMessageTemplateController {
  constructor(
    @InjectPinoLogger(WabaMessageTemplateController.name)
    private readonly logger: PinoLogger,

    private readonly messageTemplateService: MessageTemplateService,
    private readonly metaOAuthTokenService: MetaOAuthTokenService,
    private readonly waHelperService: WaHelperService,
    private readonly gatewayCredentialService: GatewayCredentialService
  ) { }


  @Get('/short')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES),
    PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
  )
  async getAllShort(
    @Query() query: GetAllShortDto,
    @Request() request: { user: LoginUser },
  ) {
    try {

      // If you have a dedicated service method, prefer it:
      const res = await this.messageTemplateService.getAllShorTemplates({ query, user: request.user });

      if (res) {

        // Project to "short" shape safely (id + title with fallbacks)
        const shortData = Array.isArray(res.data)
          ? res.data.map((t: any) => ({
            id: Number(t.id ?? t.templateId),
            title: t.title ?? t.name ?? t.templateName ?? '',
          }))
          : [];

        return returnSuccess(
          HttpStatusCode.Ok,
          'Get message templates (short).',
          shortData
        );

      }

      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong on getting message templates !',
      );
    } catch (e) {
      this.logger.error(e);
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong on getting message templates !',
      );
    }
  }

  @Get('/')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  async getAll(
    @Query() query: GetAllDto,
    @Request() request: { user: LoginUser }
  ) {
    try {
      const res = await this.messageTemplateService.getAllTemplates({ query: query, user: request.user });
      if (res) {
        return returnSuccess(
          HttpStatusCode.Ok,
          'Get message templates.',
          res.data,
          res.extraData
        );
      }
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong on getting message templates !',
      );
    }
    catch (e) {
      this.logger.error(e)
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong on getting message templates !',
      );
    }
  }
  /*
    @Post('/')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermission(AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
    async add(
      @Body() body: AddTemplateDto,
      @Request() request: { user: LoginUser },
    ) {
      const accessToken = await this.metaOAuthTokenService.findUserAccessToken(request.user.id, 'WHATS_APP');
      /* TODO: check token expiry date and re-generate again 
      if (!accessToken || !accessToken.accessToken) {
        return returnError(
          HttpStatusCode.BadRequest,
          'Your whats app integration has been expired. Connect again and try again later !',
        );
      }
  
      const templateName = body.name.replaceAll(' ', '_').toLowerCase();
      const res = await createMessageTemplate(
        {
          category: body.category,
          components: body.components,
          language: body.language as MetaLanguageCode,
          name: templateName/* note: one word, space will replace with underscore 
        },
        body.wabaId,
        accessToken.accessToken
      );
      if (res.status) {
        const createRes = await this.messageTemplateService.addTemplate({
          data: {
            category: body.category,
            components: body.components,
            language: body.language as MetaLanguageCode,
            name: templateName
          },
          user: request.user,
          wabaId: body.wabaId,
          res: {
            id: res.data.id,
            status: res.data.status,
            category: res.data.category
          }
        })
        if (createRes) {
          return returnSuccess(
            HttpStatusCode.Ok,
            'Message template created successfully',
            createRes,
          );
        }
      }
      return returnError(
        HttpStatusCode.BadRequest,
        res.message || 'Something went wrong on creating message template !',
        res.details || {}
      )
    }
  */
  @Post('/')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async addTemplate(@Body() body: TemplateCreationDto, @Request() request: { user: LoginUser }) {

    const messageTemplate = await this.messageTemplateService.findUserTemplateByName(request.user.id, body.friendly_name, body.wabaId);
    if (messageTemplate) {
      return returnError(
        HttpStatusCode.BadRequest,
        `Template already exist with this name: ` + body.friendly_name,
      )
    }

    const gatewayAuth = await this.gatewayCredentialService.loadGatewayCredentials({ agencyId: request.user.agencyId, id: null }, GatewayCredentialGatewayType.TWILIO, ["TWILIO_AUTH_KEY", "TWILIO_AUTH_TOKEN"]);
    if (!gatewayAuth || !gatewayAuth.authKey || !gatewayAuth.authToken) {
      return returnError(
        HttpStatusCode.BadRequest,
        'Twilio credentials are missing or invalid.Please reconnect your Twilio account and try again.'
      );
    }

    const templateName = body.friendly_name.replaceAll(' ', '_').toLowerCase();
    const response = await createWhatsAppMessageTemplate({ ...body, friendly_name: templateName }, gatewayAuth);
    const templateId = response.sid;
    console.log("sid....", templateId);
    if (!response.success || !templateId) {
      return returnError(
        response.status === 401 ? HttpStatusCode.Unauthorized : HttpStatusCode.BadRequest,
        response.errorMessage || 'Something went wrong on creating message template !',
        response.details || {}
      )
    }

    const createRes = await this.messageTemplateService.addMessageTemplate(request.user, { ...body, templateId });
    if (createRes) {
      return returnSuccess(
        HttpStatusCode.Ok,
        'Message template created successfully',
        createRes,
      );
    }

    return returnError(
      HttpStatusCode.BadRequest,
      response.message || 'Failed to create message template!',
      response.details || {}
    )
  }

  @Post('upload-file')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async uploadFile(@Request() request: FastifyRequestWithUser) {
    //  user info from AuthGuard
    const user = request.user;

    //  file from Fastify multipart
    const file = await request.file();
    const buffer = await file.toBuffer();

    if (!ALLOWED_META_MIME_TYPES.includes(file.mimetype)) {
      return returnError(
        HttpStatusCode.BadRequest,
        'Invalid try with wrong file.',
      );
    }

    const accessToken = await this.waHelperService.getWithRefreshToken(user.id);
    if (!accessToken.token) {
      return returnError(
        HttpStatusCode.BadRequest,
        accessToken.message
      );
    }

    const uploadRes = await uploadMetaImage({
      fileLength: buffer.length,
      fileName: file.filename,
      fileType: file.mimetype,
      token: accessToken.token,
      file: file,
      buffer: buffer
    })
    if (!uploadRes) {
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong ! Can not upload file',
      );
    }
    return returnSuccess(
      HttpStatusCode.Ok,
      'Meta file upload successfully',
      uploadRes
    );
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES), PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME))
  async deleteMessageTemplate(
    @Param('id') id: bigint,
    @Request() request: { user: LoginUser },
  ) {
    const res = await this.messageTemplateService.deleteMessageTemplate(id, request.user);
    if (res.status) {
      return returnSuccess(
        HttpStatusCode.Ok,
        res.message,
        {},
      );
    }

    return returnError(
      HttpStatusCode.BadRequest,
      res.message || 'Something went wrong on creating message template !',
      {}
    )
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.MESSAGE_TEMPLATES), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async updateTemplate(
    @Body() body: AddTemplateDto,
    @Request() request: { user: LoginUser },
    @Param('id') id: bigint,
  ) {
    const res = await this.messageTemplateService.updateMessageTemplate(
      id,
      {
        category: body.category,
        components: body.components,
        language: body.language as MetaLanguageCode,
        name: body.name
      },
      request.user
    );
    if (res.status) {
      return returnSuccess(
        HttpStatusCode.Ok,
        res.message,
        {},
      );
    }

    return returnError(
      HttpStatusCode.BadRequest,
      res.message || 'Something went wrong on creating message template !',
      {}
    )
  }
}
