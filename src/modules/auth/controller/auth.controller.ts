import { AuthGuard } from '@/common/guard/auth.guard';
import {
  Body,
  Controller,
  Get,

  Post,
  Query,
  Redirect,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
} from '../dto/change-password.dto';

import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { hashPasswordDto, registerUserDto } from '../dto/register-user.dto';
import { LoginUser, LoginUserDto } from '../dto/login-user.dto';
import { TokenService } from '../token.service';
import { LoggedInUser } from '../../user/dto/user.dto';
import { GoogleOauthFetcher } from '../sso/google.oauth.fetcher';
import { SsoProviderService } from '../service/ssoprovider.service';
import { ProviderType } from '@prisma/client';
import { GrantType } from '@/common/enums/grand.type';
import { GoogleUserProfileFetecher } from '../sso/google.user.profile.fetcher';
import { FacebookOAuthFetcher } from '../sso/facebook.oauth.fetcher';
import { FacebookUserProfileFetcher } from '../sso/facebook.user.profile.fetcher';
import { MetaOAuthTokenService } from 'src/modules/whatsapp/service/meta.oauth.token.service';
import { VerifyVerificationCodeDto } from '../dto/verify-mail.dto';
import { getApiConfig } from '@/config/config.utils';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'nestjs-prisma';
import { UserTimezone } from '@/common/decorator/timezone.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly googleOauthFetcher: GoogleOauthFetcher,
    private readonly googleUserProfileFetecher: GoogleUserProfileFetecher,
    private readonly ssoProviderService: SsoProviderService,
    private readonly facebookoAuthFetcher: FacebookOAuthFetcher,
    private readonly facebookUserProfileFetcher: FacebookUserProfileFetcher,
    private readonly metaOAuthTokenService: MetaOAuthTokenService,
    private readonly configService: ConfigService,
  ) { }

  @Post('/register')
  register(@Body() registerUser: registerUserDto, @Req() @UserTimezone() userTimezone: UserTimezone) {
    return this.authService.registerNewuser(registerUser, userTimezone);
  }

  @Post('/login')
  login(@Body() loginUser: LoginUserDto) {
    return this.authService.login(loginUser);
  }

  @Post('/generate-access-token-by-refresh-token')
  refreshToken(@Body() refreshToken: RefreshTokenDto) {
    return this.tokenService.generateAccessTokenFromRefreshToken(
      refreshToken.refresh_token,
    );
  }

  @Get('/me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getMe(@Request() request: { user: LoginUser; headers: any }) {
    return { data: request.user };
  }

  @Post('/change-password')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() request: { user: LoginUser; headers: any },
  ) {
    return this.authService.changePassword(
      request.user,
      changePasswordDto,
      request.headers,
    );
  }

  @Post('/forgot-password')
  forgotPassword(@Body() forgotDto: ForgotPasswordDto) {
    return this.authService.sendResetLink(forgotDto.email);
  }

  /**
   * single singn on using google
   * @param dto
   * @returns
   */

  @Get('/signup-with-google')
  @Redirect()
  async singinWithGoogle() {
    const url = await this.authService.getGoogleAuthUrl();
    return { url };
  }

  @Get('/google/callback')
  @Redirect()
  async handleGoogleAuthCallback(
    @Query('code') code: string,
    @Query('error') error?: string,
    @Query('timezone') timezone?: string,
  ) {
    const appConfig = getApiConfig(this.configService);

    // 🔹 Handle cancel or auth errors first
    if (error) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=${encodeURIComponent(error)}`,
      };
    }

    if (!code) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=missing_code`,
      };
    }

    const ssoProvider =
      await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
        ProviderType.GOOGLE,
        '/auth/google/callback',
      );

    const tokenResponse = await this.googleOauthFetcher.fetchTokenWithGrant(
      code,
      ssoProvider,
      GrantType.AUTHORIZATION_CODE,
    );

    if (!tokenResponse?.accessToken) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=token_failed`,
      };
    }

    const googleUserProfileInfo =
      await this.googleUserProfileFetecher.fetchGoogleUserProfile(
        tokenResponse.accessToken,
      );

    if (!googleUserProfileInfo) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=profile_failed`,
      };
    }

    const user = await this.authService.registerOrGetUserFromGoogle({
      email: googleUserProfileInfo.email,
      name: googleUserProfileInfo.name,
      picture: googleUserProfileInfo.picture,
      verifiedEmail: googleUserProfileInfo.verifiedEmail,
    }, timezone);

    const tokens = await this.tokenService.refreshUserAuthTokens(user?.id);

    return {
      url: `${appConfig.clientBaseUrl}/handle-oauth?accessToken=${tokens?.access?.token}&refreshToken=${tokens?.refresh?.token}`,
    };
  }


  @Get('/continue-with-facebook')
  @Redirect()
  async singinWithFacebook(@Query('state') state: string) {
    const url = await this.authService.getFacebookAuthUrl(state);
    return { url };
  }

  @Get('facebook/callback')
  @Redirect()
  async handleFacebookAuthCallback(
    @Query('code') code: string,
    @Query('error') error?: string,
  ) {
    const appConfig = getApiConfig(this.configService);

    // 🔹 Handle cancel/error from Facebook
    if (error) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=${encodeURIComponent(error)}`,
      };
    }

    if (!code) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=missing_code`,
      };
    }

    const ssoProvider =
      await this.ssoProviderService.findSsoProviderByProvider(ProviderType.FACEBOOK);

    const facebookAuthTokenResponse =
      await this.facebookoAuthFetcher.fetchTokenWithGrant(code, ssoProvider);

    if (!facebookAuthTokenResponse?.accessToken) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=token_failed`,
      };
    }

    const facebookUserProfileInfo =
      await this.facebookUserProfileFetcher.fetchFacebookUserProfile(
        facebookAuthTokenResponse.accessToken,
      );

    if (!facebookUserProfileInfo) {
      return {
        url: `${appConfig.clientBaseUrl}/login?error=profile_failed`,
      };
    }

    const expiresIn = facebookAuthTokenResponse.expiresIn; // e.g., 5183896 seconds
    const expiredAt = new Date(Date.now() + (expiresIn - 5) * 1000);

    const metaAccessToken = {
      accessToken: facebookAuthTokenResponse.accessToken,
      expiredAt,
    };

    // 🔹 Lookup or create user
    const userRes = await this.authService.findUserByUserEmail(
      facebookUserProfileInfo.email,
    );

    const tokens = await this.tokenService.createAndDeleteAuthTokens(
      userRes.data as LoginUser,
    );

    return {
      url: `${appConfig.clientBaseUrl}/handle-oauth?accessToken=${tokens?.access?.token}&refreshToken=${tokens?.refresh?.token}`,
    };
  }


  @Post('hash-password')
  hashPassword(@Body() dto: hashPasswordDto) {
    return this.authService.hashPassword(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('send-verification-code')
  verifyRegistration(
    @Request() request: { user: LoginUser },
  ) {
    return this.authService.sendVerificationCode(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('verify-verification-code')
  verifyVerificationCode(
    @Body() dto: VerifyVerificationCodeDto,
    @Request() request: { user: LoginUser },
  ) {
    return this.authService.verifyVerificationCode(dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("onboard-info")
  async getOnboardingStatus(
    @Query() dto: LoggedInUser,
  ) {
    return this.authService.checkOnboarding(dto);
  }

  //get user country code
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("user-country-code")
  async getUserCountryCode(
    @Req() req: any,
  ) {
    return this.authService.getUserCountryCode(req);
  }
}
