import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import crypto from 'crypto';
import { returnError, returnSuccess } from '@/common/helpers/response-handler.helper';
import { HttpStatusCode } from 'axios';
import { ExchangeCodeToTokenRequestDto, StartWabaIntegrationQueryDto } from '../dto/waba.integration.dto';
import { RedisService } from 'src/modules/redis/redis.service';
import { WabaIntegrationService } from '../service/waba.integration.service';
import { MetaOAuthTokenService } from '../service/meta.oauth.token.service';
import { FbBusinessAccountService } from '../service/fb.business.account.service';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { PermissionGuard } from '../../../common/guard/permission-guard';
import { AssetDTO } from '../../../utils/AssetDTO';
import { PermissionDTO } from '../../../utils/PermissionDTO';
import { AuthGuard } from '../../../common/guard/auth.guard';
import { RequirePermission } from '../../../common/decorator/require-permission.decorator';
import { appSecretProof, exchangeCodeToAccessToken, getFbUserData, metaAuth, verifySignature } from '@/common/wa-helper/wa-helper';
import { MetaDataSyncJobService } from '../service/metaDataSyncJobs.service';
import { ProductType } from '@prisma/client';
import { WaBusinessNumberService } from '../service/wa.business.number.service';
import { WebhookService } from '../service/webhook.service';

const { META_APP_VERIFY_TOKEN } = process.env;

@Controller('waba-integrations')
@ApiTags('WhatsApp integration')
export class WabaIntegrationController {
  constructor(
    @InjectPinoLogger(WabaIntegrationController.name)
    private readonly logger: PinoLogger,
    private redisService: RedisService,
    private readonly wabaIntegrationService: WabaIntegrationService,
    private readonly metaOAuthTokenService: MetaOAuthTokenService,
    private readonly fbBusinessAccountService: FbBusinessAccountService,
    private readonly metaDataSyncJobService: MetaDataSyncJobService,
    private readonly waBusinessNumberService: WaBusinessNumberService,
    private readonly webhookService: WebhookService,
  ) { }

  @Get('start')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async startWabaIntegration(
    @Query() query: StartWabaIntegrationQueryDto,
    @Request() request: { user: LoginUser }
  ) {
    const state = crypto.randomBytes(16).toString('hex');
    await this.redisService.storeWhatsAppIntegrationState(state, request.user.id);
    const url = metaAuth(query.redirectUrl, state);

    return returnSuccess(
      HttpStatusCode.Ok,
      'WABA connected successfully',
      {url: url},
    );
  }

  @Post('exchange-code-to-token')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async exchangeCodeToToken(
    @Body() body: ExchangeCodeToTokenRequestDto,
    @Request() request: { user: LoginUser }
  ) {
    try {
      const tokenData = await exchangeCodeToAccessToken(body.code, body.redirectUrl);
      console.log("tokenData", tokenData);
      if(tokenData === null || JSON.stringify(tokenData) === '{}'){
        return returnError(
          HttpStatusCode.BadRequest,
          'Something went wrong. Can not generate your access token !',
        );
      }

      const appSecretProofData = appSecretProof(tokenData.access_token);
      if(!appSecretProofData){
        return returnError(
          HttpStatusCode.BadRequest,
          'Can not connect with meta properly !',
        );
      }
      const fbUserData = await getFbUserData(appSecretProofData, tokenData.access_token);
      console.log("fbUserData", fbUserData)

      const tokenStoreRes = await this.metaOAuthTokenService.codeToAccessTokenManage(request.user, tokenData, {...fbUserData, ...body.data, version: "v2"});
      if(!tokenStoreRes){
        return returnError(
          HttpStatusCode.BadRequest,
          'Something went wrong. Can not connect with meta business account !',
        );
      }
      await this.metaDataSyncJobService.createNewAction(request.user.id, "ACCOUNT", tokenStoreRes);

      return returnSuccess(
        HttpStatusCode.Ok,
        'WABA connected successfully',
        {
          me: fbUserData
        },
      );
    } catch (error) {
      this.logger.error(error);
      return returnError(
        HttpStatusCode.BadRequest,
        'Can not connect with meta business account !',
      );
    }
  }

  @Get('waba-connected-data')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  async getWabaConnectedData(@Request() {user}: { user: LoginUser }){

    try{
      const getMetaData = await this.metaOAuthTokenService.findOauthTokenByUserAndProductType(user.id, ProductType.WHATS_APP)
      const businessData = await this.fbBusinessAccountService.findByUser(user.id);
      return returnSuccess(
        HttpStatusCode.Ok,
        'WABA connected successfully',
        {
          me: getMetaData,
          business: businessData
        },
      )
    }
    catch(e){
      console.log("error", e)
      return returnError(
        HttpStatusCode.BadRequest,
        'No whats app integration data found !',
      );
    }
  }

  @Put('disconnect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME))
  async disconnectMeta(
    @Request() request: { user: LoginUser }
  ) {
    try{
      await this.metaOAuthTokenService.disconnectMeta(request.user.id);
      return returnSuccess(
        HttpStatusCode.Ok,
        'Meta disconnect successfully',
        {},
      )
    }
    catch(e){
      this.logger.error(e);
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong !',
      );
    }
  }

  /* webhooks */
  @Get('/webhook')
  async metaWebhook(
    @Query() query: { 'hub.mode': string; 'hub.challenge': string; 'hub.verify_token': string },
  ){
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === META_APP_VERIFY_TOKEN
    ) {
      return query['hub.challenge'];
    } else {
      return returnError(
        HttpStatusCode.Forbidden,
        'Mode or token not matching'
      );
    }
  }
  @Post('/webhook')
  async metaWebhookListener(
    @Req() req: Request & { rawBody: Buffer },
    @Headers('x-hub-signature-256') signatureHeader: string
  ){
    // 1) Verify signature (recommended)
    const expected = verifySignature(req.rawBody);
    if (!signatureHeader || signatureHeader !== expected) {
      console.log("===========webhook============", signatureHeader, expected)
      return;
    }
    const body: any = req.body;
    await this.webhookService.addNewEventRecord(body);

    // MUST return 200 OK (no body needed)
    return;
  }

  @Post('/phone-number-verification-request')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async phoneNumberVerificationCodeSend(
    @Body() body: {numberId: bigint; type: "VOICE" | "SMS"},
    @Request() request: { user: LoginUser }
  ) {
    try{
      await this.waBusinessNumberService.sendVerificationCode(body.numberId, request.user, body.type);
      return returnSuccess(
        HttpStatusCode.Ok,
        'Phone number verification code sent successfully',
        {},
      )
    }
    catch(e){
      this.logger.error(e);
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong !',
      );
    }
  }

  @Post('/phone-number-verify-code')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async phoneNumberVerifyCode(
    @Body() body: {numberId: bigint; code: string},
    @Request() request: { user: LoginUser }
  ) {
    try{
      const res = await this.waBusinessNumberService.verifyCode(body.numberId, request.user, body.code);
      if(res){
        return returnSuccess(
          HttpStatusCode.Ok,
          'Phone number verified successfully',
          {},
        )
      }
      return returnSuccess(
        HttpStatusCode.Ok,
        'Phone number not verified',
        {},
      )
    }
    catch(e){
      this.logger.error(e);
      return returnError(
        HttpStatusCode.BadRequest,
        'Something went wrong !',
      );
    }
  }

  @Put('/subscribe-waba/:waba_account')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME))
  async subscribedWabaAccount(
    @Param('waba_account') waba_account: bigint,
    @Request() request: { user: LoginUser }
  ) {
    const res = await this.wabaIntegrationService.tryWabaSubscription(waba_account, request.user.id);
    if(res.status){
      return returnSuccess(
        HttpStatusCode.Ok,
        res.message,
        {},
      )
    }
    return returnError(
      HttpStatusCode.BadRequest,
      res.message,
      {}
    );
  }

  @Put('/unsubscribe-waba/:waba_account')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME))
  async unsubscribedWabaAccount(
    @Param('waba_account') waba_account: bigint,
    @Request() request: { user: LoginUser }
  ) {
    const res = await this.wabaIntegrationService.tryWabaUnSubscription(waba_account, request.user.id);
    if(res.status){
      return returnSuccess(
        HttpStatusCode.Ok,
        res.message,
        {},
      )
    }
    return returnError(
      HttpStatusCode.BadRequest,
      res.message,
      {}
    );
  }

  @Put('/register-number/:number_id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME))
  async registerNumber(
    @Param('number_id') number_id: bigint,
    @Request() request: { user: LoginUser }
  ) {
    const res = await this.wabaIntegrationService.tryRegisterNumber(number_id, request.user.id);
    if(res.status){
      return returnSuccess(
        HttpStatusCode.Ok,
        res.message,
        {},
      )
    }
    return returnError(
      HttpStatusCode.BadRequest,
      res.message,
      {}
    );
  }

  @Put('/deregister-number/:number_id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INTEGRATIONS), PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME))
  async deregisterNumber(
    @Param('number_id') number_id: bigint,
    @Request() request: { user: LoginUser }
  ) {
    const res = await this.wabaIntegrationService.tryDeregisterNumber(number_id, request.user.id);
    if(res.status){
      return returnSuccess(
        HttpStatusCode.Ok,
        res.message,
        {},
      )
    }
    return returnError(
      HttpStatusCode.BadRequest,
      res.message,
      {}
    );
  }

  /* sample text message send */
}
