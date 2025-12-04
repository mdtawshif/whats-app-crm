import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TokenService } from './token.service';
import { VerificationCodeService } from './verification.service';
import { UserModule } from '../user/user.module';
import { AuthController } from './controller/auth.controller';
import { EmailService } from '../email/email.service';
import { UserService } from '../user/user.service';
import { SsoProviderService } from './service/ssoprovider.service';
import { GoogleOauthFetcher } from './sso/google.oauth.fetcher';
import { FacebookOAuthFetcher } from './sso/facebook.oauth.fetcher';
import { GoogleUserProfileFetecher } from './sso/google.user.profile.fetcher';
import { FacebookUserProfileFetcher } from './sso/facebook.user.profile.fetcher';
import { MetaOAuthTokenService } from '../whatsapp/service/meta.oauth.token.service';

@Module({
  imports: [
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'test',
      signOptions: { expiresIn: '1h' },
    }),
    UserModule,
  ],
  exports: [PassportModule],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AuthService,
    TokenService,
    EmailService,
    UserService,
    VerificationCodeService,
    SsoProviderService,
    GoogleOauthFetcher,
    GoogleUserProfileFetecher,
    FacebookOAuthFetcher,
    FacebookUserProfileFetcher,
    MetaOAuthTokenService
  ],
})
export class AuthModule {}
