import axios from 'axios';
import { randomUUID } from 'crypto';

import fs from 'fs';
import path from 'path';
function getFileType(mimeType) {
  if (mimeType.startsWith('video/')) {
    return true;
  } else if (mimeType.startsWith('image/')) {
    return true;
  } else if (mimeType === 'text/html') {
    console.log('mimeType', mimeType);
    return false;
  }
  return false;
}
export async function getMimeAndSizeFromUrl(file_url: string) {
  const fileSizeResponse = await axios.head(file_url);
  const mimeType = fileSizeResponse.headers['content-type'];
  const fileSize = fileSizeResponse.headers['content-length'];
  return {
    mimeType,
    fileSize,
  };
}

//data must be passthrough | arraybuffer | stream | buffer
export async function passthroughToBuffer(data: any) {
  return await new Promise<Buffer>((resolve, reject) => {
    const bufferedChunks = [];
    data.on('data', (chunk) => {
      bufferedChunks.push(chunk);
    });
    data.on('end', () => {
      const buffer = Buffer.concat(bufferedChunks);
      resolve(buffer);
    });
    data.on('error', (err) => {
      reject(new Error(`Buffer error: ${err.message}`));
    });
  });
}

//data should be stream or buffer
export async function fileWrite(data, tempFilePath: string) {
  const writer = fs.createWriteStream(tempFilePath);
  data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      resolve(tempFilePath);
    });
    writer.on('error', reject);
  });
}

export async function deleteFile(filePath: string) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return;
    }
    console.log('File deleted successfully:', filePath);
  });
}

export function getFileMediaDownloadPath(
  uploadFilename: string,
  isImage: Boolean = false,
): string {
  const folderPath = './media';
  const ext = path.extname(uploadFilename) || isImage ? '.jpeg' : '.mp4';

  const cleanedExt = ext.startsWith('.') ? ext.slice(1) : ext;

  const filename = `${randomUUID()}.${cleanedExt}`;
  const tempFilePath = path.join(folderPath, filename);

  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  } catch (error) {
    throw new Error(
      `Failed to create directory ${folderPath}: ${error.message}`,
    );
  }

  return tempFilePath;
}
