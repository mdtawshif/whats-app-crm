import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CompleteMultipartDto } from "./dto/complete-multipart.dto";
import { CreateMultipartDto } from "./dto/create-multipart.dto";
import { MediaUploadSignedUrlDto } from "./dto/media-upload-signed-url.dto";
import { PartSignedUrlDto } from "./dto/part-signed-url.dto";
import { S3PutSignedUrlDto } from "./dto/put-signed-url.dto";
import { S3Service } from "./s3.service";
import { LoginUser } from "../auth/dto/login-user.dto";
import { AuthGuard } from '@/common/guard/auth.guard';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { GeneratePresignedUrlDto } from "./dto/generate-presigned-url.dto";

@ApiTags("S3")
@Controller("s3")
export class s3Controller {
  constructor(private readonly s3Service: S3Service,
    // private readonly s3PrivateUploadService: S3PrivateUploadService
  ) { }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post("generate-presigned-url")
  async getSignedUrl(
    @Body() s3PutSigned: S3PutSignedUrlDto,
    @Request() request: { user: LoginUser }
  ) {
    const response = await this.s3Service.getPutS3SignedURL(
      request?.user,
      s3PutSigned
    );
    return response;
  }


  //for private upload and download
  @Post('generate-presigned-url-private-upload')
  @ApiOperation({ summary: 'Generate a presigned URL for upload or download' })
  @ApiResponse({ status: 201, description: 'Presigned URL generated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiBody({ type: GeneratePresignedUrlDto })
  async generatePresignedUrl(@Body() dto: GeneratePresignedUrlDto): Promise<{ url: string }> {
    const url = await this.s3Service.generatePresignedUrl(dto);
    return { url };
  }

  // get-s3-key-from-url by given url
  @Post('get-s3-key-from-url')
  @ApiOperation({ summary: 'Get the S3 key from a URL' })
  @ApiResponse({ status: 200, description: 'S3 key extracted' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async getS3KeyFromUrl(@Body() body: { url: string }): Promise<{ key: string }> {
    const key = this.s3Service.getS3KeyFromUrl(body.url);
    return { key };
  }


  @Post("media-upload-signed-url")
  async mediaUploadSignedUrl(
    @Body() mediaUploadSignedUrlDto: MediaUploadSignedUrlDto
  ) {
    const response = await this.s3Service.mediaUploadSignedUrl(
      mediaUploadSignedUrlDto
    );
    return response;
  }

  @Post("create-multipart")
  createMultiPart(@Body() createMultipartDto: CreateMultipartDto) {
    return this.s3Service.createMultipart(createMultipartDto);
  }

  @Post("part-upload-signed-url")
  partUploadSignedUrl(@Body() partSignedUrlDto: PartSignedUrlDto) {
    return this.s3Service.partUploadSignedUrl(partSignedUrlDto);
  }

  @Post("complete-multipart")
  completeMultipart(@Body() completeMultipartDto: CompleteMultipartDto) {
    return this.s3Service.completeMultipart(completeMultipartDto);
  }
}
