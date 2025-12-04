import { Module } from "@nestjs/common";
import { CustomFieldsController } from "./custom-fields.controller";
import { CustomFieldsService } from "./custom-fields.service";
import { PrismaService } from "nestjs-prisma";
import { EmailService } from "../email/email.service";
import { RedisModule } from "../redis/redis.module";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";

@Module({
    imports: [RedisModule, ConfigModule, HttpModule],
    controllers: [CustomFieldsController],
    providers: [CustomFieldsService, PrismaService, EmailService],
    exports: [CustomFieldsService]
})
export class CustomFieldsModule { }