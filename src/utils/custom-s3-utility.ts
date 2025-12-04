import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";

import path from "node:path";
import { Readable, Writable } from "node:stream";

const generateFileName = (bytes = 32) => randomBytes(bytes).toString("hex");

const getS3Client = (s3Endpoint = process.env.S3_ENDPOINT_CONTENT) => {
  let endpoint: URL | undefined;
  if (s3Endpoint) {
    endpoint = new URL(s3Endpoint);
  }
  const region = process.env.AWS_REGION_CONTENT;
  // const bucket = process.env.S3_BUCKET_CONTENT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_CONTENT;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_CONTENT;

  // Create an S3 client
  const s3Client = new S3Client({
    region,
    endpoint: endpoint?.href,
    forcePathStyle: !!endpoint?.href,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  return s3Client;
};

const getR2Client = () => {
  const region = process.env.AWS_REGION_CONTENT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_CONTENT;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_CONTENT;

  let endpoint: URL | undefined;

  const s3Client = new S3Client({
    region: region,
    endpoint: endpoint?.href,
    forcePathStyle: !!endpoint?.href,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey
    }
  });

  return s3Client;
};

const getBufferFromReadable = async (readable: Readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return buffer;
};

export function deleteFile(fileName): Promise<any> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_CONTENT;

  console.log("fileName", fileName);
  const deleteParams = {
    Bucket: bucketName,
    Key: fileName
  };
  console.log("s3 deleteParams", deleteParams);
  return s3Client.send(new DeleteObjectCommand(deleteParams));
}

export const uploadFileToS3 = async (imageName, mimetype, fileBuffer) => {
  const bucketName = process.env.S3_BUCKET_CONTENT;

  try {
    const uploadParams = {
      Bucket: bucketName,
      Body: fileBuffer,
      Key: imageName,
      ContentType: mimetype
    };

    const s3Client = getS3Client();
    // console.log(uploadParams);
    const response = await s3Client.send(new PutObjectCommand(uploadParams));

    return {
      url: `${process.env.S3_PUBLIC_MEDIA_ENDPOINT_CONTENT}${imageName}`,
      eTag: response.ETag,
      versionId: response.VersionId
    };
  } catch (err) {
    console.error("Error uploading file::", err);
    throw err;
  }
};

export const readableBodyFromS3 = async (filename: string) => {
  const bucketName = process.env.S3_BUCKET_CONTENT;

  const params = {
    Bucket: bucketName,
    Key: filename
  };

  const command = new GetObjectCommand(params);
  const s3Client = getS3Client();
  const response = await s3Client.send(command);

  if (response.Body === undefined || !(response.Body instanceof Readable)) {
    throw Error("S3 response body is not Readable");
  }

  // Create a buffer from the fetched object body
  const body: Readable = response.Body;
  return body;
};

export const simpleReadableBodyFromS3 = async (filename: string) => {
  const bucketName = process.env.S3_BUCKET_CONTENT;

  const params = {
    Bucket: bucketName,
    Key: filename
  };

  const command = new GetObjectCommand(params);
  const s3Client = getS3Client();
  const response = await s3Client.send(command);

  if (response.Body === undefined || !(response.Body instanceof Readable)) {
    throw Error("S3 response body is not Readable");
  }

  // Create a buffer from the fetched object body
  const data: Readable = response.Body;
  const mimeType = response.ContentType;
  const fileSize = response.ContentLength;

  return response;
};

const pipeToStream = (readable: Readable, writable: Writable) =>
  new Promise((resolve, reject) => {
    readable.pipe(writable);
    writable.on("finish", resolve);
    writable.on("error", reject);
  });

export const downloadFromS3 = async (filename: string) => {
  const filePath = path.join("/tmp/", path.basename(filename));
  const fileStream = createWriteStream(filePath);
  const body: Readable = await readableBodyFromS3(filename);
  await pipeToStream(body, fileStream);
  return filePath;
};

export const readFileFromS3 = async (filename: string) => {
  const body: Readable = await readableBodyFromS3(filename);
  const imageBuffer = await getBufferFromReadable(body);
  return imageBuffer;
};

export const getPutS3SignedURL = async (
  extensionType: string,
  uploadFilename: string,
  subFolder: string,
  isMedia = false
) => {
  const bucketName = process.env.S3_BUCKET_CONTENT;
  const ext = uploadFilename.split(".").at(-1);

  const filename = `${subFolder}/${randomUUID()}.${ext}`;
  // const filename = `${randomUUID()}.${ext}`;

  let endpointPublic: URL | undefined;
  let filePath: string | undefined;

  if (isMedia) {
    endpointPublic = new URL(process.env.S3_PUBLIC_MEDIA_ENDPOINT_CONTENT);
    filePath = `${endpointPublic}${filename}`;
  } else if (process.env.S3_PUBLIC_ENDPOINT_CONTENT) {
    endpointPublic = new URL(process.env.S3_PUBLIC_ENDPOINT_CONTENT);

    filePath = `${endpointPublic}/${bucketName}/${filename}`;
  }

  // const filePath = `${endpointPublic}/${bucketName}/${filename}`;

  const uploadParams: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: filename,
    ContentType: extensionType,
    ACL: "public-read"
  };

  const expiresIn = 3600;

  const command = new PutObjectCommand(uploadParams);
  const s3Client = getS3Client();
  const signedURL = await getSignedUrl(s3Client, command, { expiresIn });

  const data = { signedURL, filePath, expiresIn };
  return data;
};

export function extractFilenameFromS3Url(url: string): string {
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  const filenameWithoutParams = filename.split("?")[0].split("#")[0];
  return filenameWithoutParams;
}
