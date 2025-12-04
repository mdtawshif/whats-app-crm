import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { PrismaService } from "nestjs-prisma";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";
import { EmailService } from "../email/email.service";

@Module({
  imports: [RedisModule, ConfigModule, HttpModule],
  controllers: [TeamController],
  providers: [TeamService, PrismaService, EmailService],
  exports: [TeamService]
})
export class TeamModule { }
