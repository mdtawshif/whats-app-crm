import { forwardRef, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ContactController } from './contact.controller';
import { PrismaModule, PrismaService } from 'nestjs-prisma';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ContactService } from './contact.service';
import { ApiKeyGuard } from '@/common/guard/api-key.guard';
import { AuthGuard } from '@/common/guard/auth.guard';
import { ContactUploadService } from './contact-upload/contact-upload.service';
import { ContactUploadCronService } from './contact-upload/contact-upload-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TriggerModule } from '../trigger/trigger.module';
import { BullModule } from '@nestjs/bullmq';
import { ContactUploadQueueService } from './contact-upload/contact-upload-queue.service';
import { ContactUploadProcessor } from './contact-upload/contact-upload.processor';
import { UserModule } from '../user/user.module';
import { ContactUploadFileDownloadService } from './contact-upload/contact-upload-file-download.service';
import { QUEUE_NAMES } from '@/common/constants/queues.constants';
import { ContactUploadProcessWorker } from './contact-upload/contact.upload.process.worker';
import { ContactUploadHelperService } from './contact-upload/contact.upload.helper.service';
import { ContactTagService } from './contact-upload/contact.upload.tag.service';
import { ContactUploadCustomFieldService } from './contact-upload/contact.upload.customfield.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.CONTACT_IMPORT_QUEUE,
    }),
    forwardRef(() => TriggerModule),
    RedisModule,
    IntegrationsModule,
    NotificationsModule,
    PrismaModule,
    UserModule
  ],
  controllers: [ContactController],
  providers: [
    ContactService,
    ContactUploadService,
    ContactUploadCronService,
    ContactUploadQueueService,
    ContactUploadProcessor,
    PrismaService,
    ApiKeyGuard,
    AuthGuard,
    ContactUploadFileDownloadService,
    ContactUploadProcessWorker,
    ContactUploadHelperService,
    ContactTagService,
    ContactUploadCustomFieldService
  ],
  exports: [
    ContactService,
    ContactUploadService,
    ContactUploadCronService,
    ContactUploadFileDownloadService
  ],
})
export class ContactModule { }
