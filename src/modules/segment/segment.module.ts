import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SegmentController } from "./segment.controller";
import { SegmentService } from "./segment.service";
import { PrismaService } from "nestjs-prisma";
import { EmailService } from "../email/email.service";
import { RedisModule } from "../redis/redis.module";


@Module({
    imports: [RedisModule, ConfigModule, HttpModule],
    controllers: [SegmentController],
    providers: [SegmentService, PrismaService, EmailService],
    exports: [SegmentService]
})
export class SegmentModule { }