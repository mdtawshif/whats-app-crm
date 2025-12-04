import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { PrismaService } from "nestjs-prisma";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { TagController } from "./tag.controller";
import { EmailService } from "../email/email.service";
import { TagService } from "./tag.service";

@Module({
  imports: [RedisModule, ConfigModule, HttpModule],
  controllers: [TagController],
  providers: [TagService, PrismaService, EmailService],
  exports: [TagService]
})
export class TagModule { }
