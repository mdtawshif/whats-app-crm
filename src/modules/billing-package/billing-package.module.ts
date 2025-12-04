import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PrismaService } from 'nestjs-prisma';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingPackageController } from './billing-package.controller';
import { BillingService } from './billing-package.service';
import { BillingTransactionController } from './billing.transaction.controller';
import { BillingTransactionService } from './billing-transaction.service';

@Module({
  imports: [RedisModule, ConfigModule, HttpModule],
  controllers: [BillingPackageController, BillingTransactionController],
  providers: [BillingService, PrismaService, BillingTransactionService],
  exports: [BillingService],
})
export class BillingPackageModule {}
