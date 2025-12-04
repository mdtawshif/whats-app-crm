import {
  DeleteObjectCommand,
  GetObjectCommand,
  ObjectCannedACL,
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
import { removeTrailingSlash } from "./utils";

const generateFileName = (bytes = 32) => randomBytes(bytes).toString("hex");

const getS3Client = (s3Endpoint = process.env.S3_ENDPOINT) => {
  let endpoint: URL | undefined;
  if (s3Endpoint) {
    endpoint = new URL(s3Endpoint);
  }

  // Create an S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    // endpoint: endpoint?.href,
    // forcePathStyle: !!endpoint?.href,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  console.log('process.env.AWS_ACCESS_KEY_ID', process.env.AWS_ACCESS_KEY_ID);
  console.log('process.env.AWS_SECRET_ACCESS_KEY', process.env.AWS_SECRET_ACCESS_KEY);

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

export function deleteFile(fileName) {
  const s3Client = getS3Client();
  const bucketName = process.env.AWS_BUCKET_NAME;
  const deleteParams = {
    Bucket: bucketName,
    Key: fileName
  };

  return s3Client.send(new DeleteObjectCommand(deleteParams));
}

export const uploadFileToS3 = async (imageName, mimetype, fileBuffer) => {
  const bucketName = process.env.AWS_BUCKET_NAME;

  try {
    const uploadParams = {
      Bucket: bucketName,
      Body: fileBuffer,
      Key: imageName,
      ContentType: mimetype
    };
    const s3Client = getS3Client(process.env.AWS_S3_PUBLIC_ENDPOINT);
    const response = await s3Client.send(new PutObjectCommand(uploadParams));
    return {
      url: `${process.env.AWS_S3_PUBLIC_ENDPOINT}${imageName}`,
      eTag: response.ETag,
      versionId: response.VersionId
    };
  } catch (err) {
    console.error("Error uploading file:", err);
    throw err;
  }
};

export const readableBodyFromS3 = async (filename: string) => {
  const bucketName = process.env.AWS_BUCKET_NAME;

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



/**
 * Generate a presigned PUT URL for uploading a file to S3
 *
 * @param {string} extensionType - MIME type, e.g., 'text/csv'
 * @param {string} uploadFilename - e.g., 'myfile.csv'
 * @param {string} subFolder - e.g., 'bulk_purchase'
 * @returns {Promise<{ signedURL: string, filePath: string, expiresIn: number }>}
 */
export const getPutS3PreSignedURL = async (
  extensionType: string,
  uploadFilename: string,
  subFolder: string
): Promise<{ signedURL: string; filePath: string; expiresIn: number }> => {
  const bucketName = process.env.S3_BUCKET_CONTENT;
  const ext = uploadFilename.split(".").at(-1);
  const filename = `${subFolder}/${randomUUID()}.${ext}`;

  // Fix URL construction
  const endpoint = process.env.S3_ENDPOINT_CONTENT;
  const filePath = `${removeTrailingSlash(endpoint)}/${bucketName}/${filename}`;

  const s3Client = new S3Client({
    region: process.env.AWS_REGION_CONTENT,
    endpoint: process.env.S3_ENDPOINT_CONTENT,
    forcePathStyle: false,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID_CONTENT,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_CONTENT,
    },
  });

  const uploadParams: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: filename,
    ContentType: extensionType,
    ACL: ObjectCannedACL.public_read,
  };

  const command = new PutObjectCommand(uploadParams);
  const expiresIn = 3600;
  const signedURL = await getSignedUrl(s3Client, command, { expiresIn });

  return { signedURL, filePath, expiresIn };
}

export const getPutS3SignedURL = async (
  extensionType: string,
  uploadFilename: string,
  subFolder: string
) => {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const ext = uploadFilename.split(".").at(-1);
  const filename = `${subFolder}/${randomUUID()}.${ext}`;
  const filePath = `https://s3.amazonaws.com/${bucketName}/${filename}`;

  const uploadParams: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: filename,
    ContentType: extensionType,
    // ACL: "public-read"
  };

  const expiresIn = 3600;

  const command = new PutObjectCommand(uploadParams);
  const s3Client = getS3Client(process.env.AWS_S3_PUBLIC_ENDPOINT);
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

export async function checkS3Connection(): Promise<boolean> {
  try {
    const demoImageName = "demo-image.jpg"; // demo image file
    const demoImagePath = "/path/to/demo-image.jpg"; // Path to the demo image file
    const demoImageMimetype = "image/jpeg"; // MIME type of the demo image file

    const test = await uploadFileToS3(
      demoImageName,
      demoImagePath,
      demoImageMimetype
    );
    return !!test;
  } catch (error) {
    return error.message;
  }
}
