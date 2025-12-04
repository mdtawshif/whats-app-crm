import { QUEUE_NAMES } from '@/common/constants/queues.constants';
import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from 'nestjs-prisma';
import { EmailService } from '../email/email.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService, EmailService],
  imports: [RedisModule],
  exports: [UserService],
})
export class UserModule {}
