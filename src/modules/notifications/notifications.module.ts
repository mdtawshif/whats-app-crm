import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsGateway } from './notifications.gateway';
import { UserModule } from '../user/user.module';
import { TokenController } from './token.controller';
import { NotificationController } from './notifications.controller';
import * as admin from 'firebase-admin';
import { PrismaModule } from 'nestjs-prisma';
import { NotificationService } from './notifications.service';
import { TokenService } from './token.service';
import { NotificationProcessor } from './notification.processor';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '@/config/app.config';
import { getAppConfig } from '@/config/config.utils';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { RedisModule } from '../redis/redis.module';
import { RedisNotificationService } from './redis.notifications.service';
import { PubSubService } from './pubsub/pubsub.service';

@Module({
  imports: [
    RedisModule,
    UserModule,
    PrismaModule,
    BullModule.registerQueue({
      name: 'notifications-queue',
    }),
  ],
  controllers: [TokenController, NotificationController],
  providers: [NotificationsGateway, NotificationService, WsAuthMiddleware, TokenService, NotificationProcessor, RedisNotificationService, PubSubService],
  exports: [
    NotificationsGateway,
    RedisNotificationService,
    NotificationService,
    WsAuthMiddleware,
    TokenService,
    PubSubService,
  ],
})
export class NotificationsModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService<AppConfig>) { }
  async onModuleInit() {
    if (!admin.apps.length) {
      const appConfig = getAppConfig(this.configService);
      const serviceAccount = {
        type: 'service_account',
        project_id: appConfig.firebaseProjectId,
        private_key_id: appConfig.firebasePrivateKeyId,
        private_key: appConfig.firebasePrivateKey?.replace(/\\n/g, '\n'),
        client_email: appConfig.firebaseClientEmail,
        client_id: appConfig.firebaseClientId,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: appConfig.firebaseClientX509CertUrl,
        universe_domain: 'googleapis.com',
      };
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
    }
  }
}