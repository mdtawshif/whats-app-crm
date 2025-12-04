import { CompletedPartDto } from '@/modules/s3process/dto/complete-multipart.dto';
import {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommandInput,
  CompletedPart,
  CreateMultipartUploadCommandInput,
  UploadPartCommandInput,
  PutObjectCommandInput,
  PutObjectCommand,
  ListBucketsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { removeTrailingSlash } from './utils';

export default class S3Multipart {
  private region: string;
  private bucket: string;
  private mediaUploadPrefix: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private endpoint: URL | null;
  private endpointPublic: URL | null;
  private endpointPublicMedia: URL | null;

  constructor(
    region: string,
    bucket: string,
    mediaUploadPrefix: string,
    accessKeyId: string,
    secretAccessKey: string,
    endpoint: URL | null,
    endpointPublic: URL | null,
    endpointPublicMedia: URL | null,
  ) {
    this.region = region;
    this.bucket = bucket;
    this.mediaUploadPrefix = mediaUploadPrefix;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.endpoint = endpoint;
    this.endpointPublic = endpointPublic;
    this.endpointPublicMedia = endpointPublicMedia;
  }

  private get client() {
    const client = new S3Client({
      region: this.region,
      endpoint: this.endpoint?.href,
      forcePathStyle: !!this.endpoint?.href,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    return client;
  }

  private get clientPublic() {
    const client = new S3Client({
      region: this.region,
      endpoint: this.endpointPublic?.href,
      forcePathStyle: !!this.endpointPublic?.href,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    return client;
  }

  private getFileURL(filePath: string) {
    let fileURL = `https://${this.bucket}.s3.amazonaws.com/${filePath}`;

    let s3PublicBase = this.endpointPublic.href;
    if (!s3PublicBase.endsWith('/')) {
      s3PublicBase = `${this.endpointPublic.href}/`;
    }

    if (this.endpointPublic) {
      fileURL = `${s3PublicBase}${this.bucket}/${filePath}`;
    }

    if (this.endpointPublicMedia) {
      fileURL = `${removeTrailingSlash(this.endpointPublicMedia.href)}/${filePath}`;
    }

    return fileURL;
  }

  private sanitizeFilename(filename: string) {
    return (filename || '')
      ?.toLowerCase?.()
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .slice(-50);
  }

  async mediaUploadSignedUrl(filename: string) {
    const uuid = randomUUID();
    const filePath = `${this.mediaUploadPrefix}${uuid}_${this.sanitizeFilename(filename)}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: filePath,
    };

    const cmd = new PutObjectCommand(params);
    const signedURL = await getSignedUrl(this.clientPublic, cmd, {
      expiresIn: 1 * 60 * 60,
    });

    const fileURL = this.getFileURL(filePath);

    return { fileURL, filePath, signedURL };
  }

  async createMultipartUpload(filename: string) {
    const uuid = randomUUID();
    const filePath = `${this.mediaUploadPrefix}${uuid}_${this.sanitizeFilename(filename)}`;

    const input: CreateMultipartUploadCommandInput = {
      Bucket: this.bucket,
      Key: filePath,
      ContentType: 'video/webm',
    };

    const cmd = new CreateMultipartUploadCommand(input);
    const { UploadId: uploadId } = await this.client.send(cmd);

    return { filePath, uploadId };
  }

  async getPartUploadUrl(
    uploadId: string,
    filePath: string,
    partNumber: number,
  ) {
    const params: UploadPartCommandInput = {
      Bucket: this.bucket,
      Key: filePath,
      UploadId: uploadId,
      PartNumber: partNumber,
    };

    const cmd = new UploadPartCommand(params);
    const signedURL = await getSignedUrl(this.clientPublic, cmd, {
      expiresIn: 1 * 60 * 60,
    });

    return { signedURL };
  }

  completeUpload = async (
    filePath: string,
    uploadId: string,
    completedparts: CompletedPartDto[],
  ) => {
    const parts: CompletedPart[] = completedparts.map((item) => {
      return { ETag: item.etag, PartNumber: item.partNumber };
    });

    const params: CompleteMultipartUploadCommandInput = {
      Bucket: this.bucket,
      Key: filePath,
      MultipartUpload: {
        Parts: parts,
      },
      UploadId: uploadId,
    };

    const cmd = new CompleteMultipartUploadCommand(params);
    const { Location: location } = await this.client.send(cmd);

    const fileURL = this.getFileURL(filePath);

    return { fileURL, filePath };
  };

  async checkS3Connection(): Promise<boolean> {
    try {
      const listObjectsParams = {
        Bucket: this.bucket,
        MaxKeys: 1,
      };

      const object = await this.client.send(
        new ListObjectsV2Command(listObjectsParams),
      );
      return !!object?.Contents;
    } catch (error) {
      console.log(error);
      return error.message;
    }
  }
}

export const getS3MultipartClient = () => {
  const region = process.env.AWS_REGION_CONTENT;
  const bucket = process.env.S3_BUCKET_CONTENT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_CONTENT;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_CONTENT;
  const mediaUploadPrefix = '';

  let endpoint: URL | undefined;
  let endpointPublic: URL | undefined;
  let endpointPublicMedia: URL | undefined;

  if (process.env.S3_ENDPOINT_CONTENT) {
    endpoint = new URL(process.env.S3_ENDPOINT_CONTENT);
  }

  if (process.env.S3_PUBLIC_ENDPOINT_CONTENT) {
    endpointPublic = new URL(process.env.S3_PUBLIC_ENDPOINT_CONTENT);
  }

  if (process.env.S3_PUBLIC_MEDIA_ENDPOINT_CONTENT) {
    endpointPublicMedia = new URL(process.env.S3_PUBLIC_MEDIA_ENDPOINT_CONTENT);
  }

  const s3MultipartClient = new S3Multipart(
    region,
    bucket,
    mediaUploadPrefix,
    accessKeyId,
    secretAccessKey,
    endpoint,
    endpointPublic,
    endpointPublicMedia,
  );

  return s3MultipartClient;
};
