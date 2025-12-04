import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

import S3Multipart, {
  getS3MultipartClient
} from "@/utils/custom-s3-multipart-utility";

import {
  returnError,
  returnSuccess
} from "../../common/helpers/response-handler.helper";

import { getPutS3PreSignedURL } from "@/utils/s3-utility";
import { CompleteMultipartDto } from "./dto/complete-multipart.dto";
import { CreateMultipartDto } from "./dto/create-multipart.dto";
import { MediaUploadSignedUrlDto } from "./dto/media-upload-signed-url.dto";
import { PartSignedUrlDto } from "./dto/part-signed-url.dto";
import { S3PutSignedUrlDto } from "./dto/put-signed-url.dto";
import { LoginUser } from "../auth/dto/login-user.dto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { getAppConfig } from "@/config/config.utils";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PresignedUrlOperation, type GeneratePresignedUrlDto } from "./dto/generate-presigned-url.dto";


@Injectable()
export class S3Service {
  s3MultipartClient: S3Multipart;
  private s3Client: S3Client;
  private defaultBucket: string;

  constructor(@InjectPinoLogger(S3Service.name)
  private readonly logger: PinoLogger,
    private readonly configService: ConfigService
  ) {

    this.s3MultipartClient = getS3MultipartClient();

    const appConfig = getAppConfig(this.configService);
    this.s3Client = new S3Client({
      region: appConfig.awsRegion,
      endpoint: appConfig.s3Endpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId: appConfig.awsAccessKey,
        secretAccessKey: appConfig.awsSecretKey,
      },
    });
    this.defaultBucket = appConfig.s3Bucket || 'whatsappcrm';

  }

  async getPutS3SignedURL(user: LoginUser, s3PutSigned: S3PutSignedUrlDto) {
    try {
      console.log("s3PutSigned===========", s3PutSigned);
      const folderName = s3PutSigned?.actionName
        ? s3PutSigned?.actionName
        : "csv_upload";

      const subFolder = `${user.id}/${folderName?.toLocaleLowerCase()}`;

      const data = await getPutS3PreSignedURL(
        s3PutSigned?.contentType,
        s3PutSigned?.key,
        subFolder
      );

      console.log("folderName===========", folderName);

      return returnSuccess(200, "Success", data);
    } catch (error) {
      this.logger.error(error);
      return returnError(400, error);
    }
  }

  async mediaUploadSignedUrl(mediaUploadSignedUrlDto: MediaUploadSignedUrlDto) {
    try {
      const data = await this.s3MultipartClient.mediaUploadSignedUrl(
        mediaUploadSignedUrlDto.filename
      );
      return returnSuccess(200, "upload url created", data);
    } catch (error) {
      this.logger.error(error);
      return returnError(500, "failed to create upload url");
    }
  }

  async createMultipart(createMultipartDto: CreateMultipartDto) {
    try {
      const data = await this.s3MultipartClient.createMultipartUpload(
        createMultipartDto.filename
      );

      return returnSuccess(200, "multipart upload url created", data);
    } catch (error) {
      this.logger.error(error);
      return returnError(500, "failed to create upload url");
    }
  }

  async partUploadSignedUrl(partSignedUrlDto: PartSignedUrlDto) {
    try {
      const data = await this.s3MultipartClient.getPartUploadUrl(
        partSignedUrlDto.uploadId,
        partSignedUrlDto.filePath,
        partSignedUrlDto.partNumber
      );
      return returnSuccess(200, "part upload url created", data);
    } catch (error) {
      this.logger.error(error);
      return returnError(500, "failed to create part upload url");
    }
  }

  async completeMultipart(completeMultipartDto: CompleteMultipartDto) {
    try {
      const data = await this.s3MultipartClient.completeUpload(
        completeMultipartDto.filePath,
        completeMultipartDto.uploadId,
        completeMultipartDto.completedParts
      );

      return returnSuccess(200, "upload created", data);
    } catch (error) {
      this.logger.error(error);
      return returnError(500, "failed to complete multipart upload");
    }
  }

  //Private s3 upload and download  services

  async generatePresignedUrl(dto: GeneratePresignedUrlDto): Promise<string> {
    try {
      const { key, operation, bucket = this.defaultBucket, contentType } = dto;
      let command: PutObjectCommand | GetObjectCommand;

      if (operation === PresignedUrlOperation.UPLOAD) {
        command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        });
      } else if (operation === PresignedUrlOperation.DOWNLOAD) {
        command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });
      } else {
        throw new BadRequestException('Invalid operation');
      }

      this.logger.info(`Generating presigned URL for ${operation} on key: ${key}`);
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  getS3KeyFromUrl(url: string): string {
    try {
      if (!url.startsWith('https://')) {
        throw new BadRequestException('Invalid URL');
      }

      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter((part) => part);

      const bucketIndex = pathParts.findIndex((part) => part === this.defaultBucket);

      if (bucketIndex === -1) {
        throw new BadRequestException('Bucket not found in URL');
      }

      const key = pathParts.slice(bucketIndex + 1).join('/');

      if (!key) {
        throw new BadRequestException('Key not found in URL');
      }

      this.logger.info(`Extracted S3 key: ${key} from URL`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to parse S3 URL: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to parse URL: ${error.message}`);
    }
  }
}
