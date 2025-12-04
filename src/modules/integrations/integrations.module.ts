import { forwardRef, Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { AuthModule } from '../auth/auth.module'; // Import AuthModule for SsoProviderService and GoogleOauthFetcher
import { LoggerModule } from 'nestjs-pino'; // Assuming you're using a LoggerModule for PinoLogger
import { GoogleOauthFetcher } from '../auth/sso/google.oauth.fetcher';
import { SsoProviderService } from '../auth/service/ssoprovider.service';
import { TriggerModule } from '../trigger/trigger.module';
import { PrismaModule } from 'nestjs-prisma';
import { MetaOAuthTokenService } from '../whatsapp/service/meta.oauth.token.service';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [
    forwardRef(() => TriggerModule),
    AuthModule, // Provides SsoProviderService and GoogleOauthFetcher
    PrismaModule,

    LoggerModule, // Provides PinoLogger
    NotificationsModule
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    GoogleOauthFetcher,
    SsoProviderService,
    MetaOAuthTokenService
  ],
  exports: [IntegrationsService], // Export for use in ContactModule
})
export class IntegrationsModule { }