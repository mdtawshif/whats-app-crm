import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from 'nestjs-prisma';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { apiConfig } from '@/config/api.config';
import { appConfig } from '@/config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomExceptionFilter } from './common/filters/error-format.filter';
import { ResponseFormatInterceptor } from './common/interceptors/response.interceptor';
import { TranslationService } from './common/translation.service';
import { AuthModule } from './modules/auth/auth.module';
import { BillingPackageModule } from './modules/billing-package/billing-package.module';
import { UserModule } from './modules/user/user.module';
import { RedisModule } from './modules/redis/redis.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { ContactModule } from './modules/contacts/contact.module';
import { TeamModule } from './modules/team/team.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TagModule } from './modules/tag/tag.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { BroadcastModule } from './modules/broadcast/broadcast.module';
import { SegmentModule } from './modules/segment/segment.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { InboxThreadModule } from './modules/inbox-thread/inbox-thread.module';
import { PermissionModule } from './modules/permission/permission.module';
import { PersonalizationModule } from './modules/personalization/personalization.module';
import { OptOutModule } from './modules/opt-out/opt-out.module';
import { TriggerModule } from './modules/trigger/trigger.module';
import { RoleGuard } from './common/guard/role-guard';
import pino from 'pino';
import { S3Module } from './modules/s3/s3.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ReportModule } from './modules/reports/report.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable scheduler
    ConfigModule.forRoot({
      load: [appConfig, apiConfig],
      isGlobal: true,
      cache: true,
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        // logger, //this was initially set to logger
        autoLogging: false, // Log HTTP requests
        // Use a custom logger to filter out specific contexts
        logger: pino({
          level: 'trace', // 👈 allow ALL log levels
          // Filter out logs based on context
          formatters: {
            log: (object) => {
              // Skip logs with RouterExplorer or RoutesResolver context
              if (
                // Filter Nest application bootstrap logs
                object.context === 'NestApplication' ||
                // Previously filtered contexts
                object.context === 'RouterExplorer' ||
                object.context === 'RoutesResolver'
              ) {
                return {}; // Return empty object to skip logging
              }
              return object;
            },
          },
        }),
      },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('app.throttleTime'),
            limit: config.get<number>('app.throttleLimit'),
          },
        ],
        errorMessage: 'Too many requests. Please try again later.',
      }),
      inject: [ConfigService],
    }),

    PrismaModule.forRoot({
      isGlobal: true,
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        let password: string | undefined;
        const useRedisPassword = configService.get<string>('app.useRedisPassword');
        if (useRedisPassword) {
          password = configService.get<string>('app.redisPassword');
        }
        const bullPruneAgeSeconds = configService.get<number>('app.bullPruneAgeSeconds');
        const bullPruneKeepCount = configService.get<number>('app.bullPruneKeepCount');
        const bullPruneFailedAgeSeconds = configService.get<number>('app.bullPruneFailedAgeSeconds');
        const bullPruneFailedKeepCount = configService.get<number>('app.bullPruneFailedKeepCount');

        return {
          defaultJobOptions: {
            removeOnComplete: {
              age: bullPruneAgeSeconds,
              count: bullPruneKeepCount,
            },
            removeOnFail: {
              age: bullPruneFailedAgeSeconds,
              count: bullPruneFailedKeepCount,
            },
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 10 * 1000,
            },
          },
          connection: {
            host: configService.get<string>('app.redisHost'),
            port: configService.get<number>('app.redisPort'),
            password,
          },
        };
      },
      inject: [ConfigService],
    }),

    AuthModule,
    RedisModule,
    BillingPackageModule,
    UserModule,
    WhatsAppModule,
    ContactModule,
    TeamModule,
    S3Module,
    IntegrationsModule,
    PaymentModule,
    TagModule,
    ApiKeyModule,
    BroadcastModule,
    SegmentModule,
    CustomFieldsModule,
    NotificationsModule,
    TasksModule,
    ConversationModule,
    InboxThreadModule,
    PermissionModule,
    PersonalizationModule,
    OptOutModule,
    TriggerModule,
    WebhookModule,
    ReportModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RoleGuard,

    TranslationService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (translationService: TranslationService) =>
        new ResponseFormatInterceptor(translationService),
      inject: [TranslationService],
    },
    {
      provide: APP_FILTER,
      useClass: CustomExceptionFilter,
    },
  ],
})
export class AppModule { }