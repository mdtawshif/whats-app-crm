import { Module } from "@nestjs/common";
import { s3Controller } from "./s3.controller";
import { S3Service } from "./s3.service";

@Module({
  providers: [S3Service],
  controllers: [s3Controller],
  exports: [S3Service],
})
export class S3Module { }
