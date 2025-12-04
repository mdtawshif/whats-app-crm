import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { OptOutController } from "./opt-out.controller";
import { OptOutService } from "./opt-out.service";
import { PrismaService } from "nestjs-prisma";

@Module({
    imports: [RedisModule, ConfigModule, HttpModule],
    controllers: [OptOutController],
    providers: [OptOutService, PrismaService],
    exports: [OptOutService]
})


export class OptOutModule { }