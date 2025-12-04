// import {
//   Body,
//   Controller,
//   Get,
//   Post,
//   Query,
//   Request,
//   UseGuards,
// } from '@nestjs/common';
// import { MetaOAuthTokenService } from '../service/meta.oauth.token.service';
// import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// import { AuthGuard } from '@/common/guard/auth.guard';
// import { UserDto } from 'src/modules/user/dto/user.dto';
// import { MetaProductType, WhatsAppBusinessAccountStatus } from '@prisma/client';
// import axios, { HttpStatusCode } from 'axios';
// import {
//   returnError,
//   returnSuccess,
// } from '@/common/helpers/response-handler.helper';
// import { FACEBOOK_VERSION } from '@/config/constant';
// import { WABAResponse } from '../interface/waba.interface';
// import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
// import { WabaCreateRequest } from '../dto/waba.dto';
// import { lookup } from 'dns';
// import { WhatsAppBusinessAccountCreateRequest } from '../interface/wa.business.account.interface';
// import { WaBusinessAccountService } from '../service/waba.service';
// import { LoginUser } from 'src/modules/auth/dto/login-user.dto';

// @Controller('waba')
// @ApiTags('WhatsApp')
// export class WaBusinessAccountController {
//   constructor(
//     private readonly metaOauthTokenService: MetaOAuthTokenService,
//     private readonly waBusinessAccountService: WaBusinessAccountService,
//     @InjectPinoLogger()
//     private readonly logger: PinoLogger,
//   ) { }

//   @Get('lists')
//   @ApiBearerAuth()
//   @UseGuards(AuthGuard)
//   async getAllWABusinesssAccounts(
//     @Query('fb-businessId') fbBusinessId: string,
//     @Request() request: { user: LoginUser },
//   ) {
//     const metaOauthToken =
//       await this.metaOauthTokenService.findOauthTokenByUserAndProductType(
//         request.user.id,
//         MetaProductType.WHATS_APP,
//       );
//     if (this.metaOauthTokenService.isTokenInvalid(metaOauthToken)) {
//       return returnError(
//         HttpStatusCode.BadRequest,
//         'Access token is expired or missing.Please reauthenticate',
//       );
//     }

//     const waba_base_url = `https://graph.facebook.com/${FACEBOOK_VERSION}/${fbBusinessId}/whatsapp_business_accounts`;
//     try {
//       const response = await axios.get(waba_base_url, {
//         params: { access_token: metaOauthToken.accessToken },
//       });

//       if (response.data.code >= 200 && response.data.code < 300) {
//         // use case: should we check on db and add the missing on db
//         return returnSuccess(
//           HttpStatusCode.Ok,
//           'Waba found successfully',
//           response.data as WABAResponse,
//         );
//       }
//     } catch (error) {
//       this.logger.error(error);
//       return returnError(
//         HttpStatusCode.BadRequest,
//         'No Wa business account found!',
//       );
//     }
//   }

//   @Post()
//   @ApiBearerAuth()
//   @UseGuards()
//   async createNewWABA(
//     @Body() wabaCreateRequest: WabaCreateRequest,
//     @Request() request: { user: LoginUser },
//   ) {
//     const metaOauthToken =
//       await this.metaOauthTokenService.findOauthTokenByUserAndProductType(
//         request.user.id,
//         MetaProductType.WHATS_APP,
//       );
//     if (this.metaOauthTokenService.isTokenInvalid(metaOauthToken)) {
//       return returnError(
//         HttpStatusCode.BadRequest,
//         'Access token is expired or missing.Please reauthenticate',
//       );
//     }

//     const waba_base_url = `https://graph.facebook.com/${FACEBOOK_VERSION}/${wabaCreateRequest.fbBusinessId}/whatsapp_business_accounts`;
//     const payload = {
//       name: wabaCreateRequest.name,
//     };
//     try {
//       const response = await axios.post(waba_base_url, payload, {
//         headers: { 'Content-Type': 'application/json' },
//         params: { access_token: metaOauthToken.accessToken },
//       });

//       if (
//         response.data.code >= 200 &&
//         response.data.code < 300 &&
//         !response.data.id
//       ) {
//         const whatsAppBusinessAccountCreateRequest: WhatsAppBusinessAccountCreateRequest =
//         {
//           userId: request.user.id,
//           agencyId: request.user.agencyId,
//           teamId: request.user.teamId,
//           name: wabaCreateRequest.name,
//           fbBusinessId: wabaCreateRequest.fbBusinessAccountId,
//           status: WhatsAppBusinessAccountStatus.ACTIVE,
//           wabaId: response.data.id,
//         };

//         const whatsAppBusinessAccount =
//           await this.waBusinessAccountService.addWaba(
//             whatsAppBusinessAccountCreateRequest,
//           );
//         return {
//           wabaId: response.data.id,
//           fbBusinessId: wabaCreateRequest.fbBusinessId,
//           name: wabaCreateRequest.name,
//         };
//       }
//     } catch (error) {
//       this.logger.error(error);
//       return returnError(
//         HttpStatusCode.BadRequest,
//         'Unable to create waba.Please try again',
//       );
//     }
//   }
// }
