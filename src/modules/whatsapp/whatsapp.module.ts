import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserModule } from '../user/user.module';
import { UserService } from '../user/user.service';
import { FacebookUserProfileFetcher } from '../auth/sso/facebook.user.profile.fetcher';
import { FacebookOAuthFetcher } from '../auth/sso/facebook.oauth.fetcher';
import { SsoProviderService } from '../auth/service/ssoprovider.service';
import { FbBusinessAccountService } from './service/fb.business.account.service';
import { MetaOAuthTokenService } from './service/meta.oauth.token.service';
import { MessageTemplateService } from './service/wa.message.template.service';
import { WabaIntegrationController } from './controller/waba.integration.controller';
import { WabaIntegrationService } from './service/waba.integration.service';
import { WabaMessageTemplateController } from './controller/waba.message_template.controller';
import { WaBusinessAccountController } from './controller/wa-business.controller';
import { WaBusinessAccountService } from './service/wa.business.account.service';
import { WaHelperService } from './service/wa-helper.service';
import { MetaDataSyncJobService } from './service/metaDataSyncJobs.service';
import { WaMessagingController } from './controller/wa-messaging.controller';
import { WaMessagingService } from './service/wa.messaging.service';
import { WaBusinessNumberService } from './service/wa.business.number.service';
import { ContactService } from '../contacts/contact.service';

import { EmailService } from '../email/email.service';
import { TriggerModule } from '../trigger/trigger.module';
import { WaBusinessNumberController } from './controller/wa.business.number';
import { PrismaService } from 'nestjs-prisma';
import { WebhookService } from './service/webhook.service';
import { GatewayCredentialService } from '../gateway-provider/gateway.credential.service';
import { GatewayCredentialRepository } from '../broadcast/repository/gateway.credential.repository';

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
    forwardRef(() => TriggerModule),

  ],
  exports: [PassportModule, WaBusinessNumberService],
  controllers: [
    WabaIntegrationController,
    WabaMessageTemplateController,
    WaBusinessAccountController,
    WaBusinessNumberController,
    WaMessagingController
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    PrismaService,
    UserService,
    SsoProviderService,
    FacebookOAuthFetcher,
    FacebookUserProfileFetcher,
    FbBusinessAccountService,
    MetaOAuthTokenService,
    MessageTemplateService,
    WabaIntegrationService,
    WaBusinessAccountService,
    WaHelperService,
    MetaDataSyncJobService,
    WaMessagingService,
    WaBusinessNumberService,
    ContactService,
    EmailService,
    WebhookService,
    GatewayCredentialService,
    GatewayCredentialRepository
  ],

})
export class WhatsAppModule { }
