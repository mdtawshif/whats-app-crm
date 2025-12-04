import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { Readable } from 'stream';

@Injectable()
export class ContactUploadFileDownloadService {
  constructor() {}

  /**
   * Downloads a file from a public URL
   * @param url - Publicly accessible URL of the file
   * @returns File content as string
   */
  async downloadFile(url: string): Promise<string> {
    try {
      if (!url.startsWith('https://')) {
        throw new BadRequestException('Invalid URL: Must start with https://')
      }

      const response = await axios.get(url, {
        responseType: 'text'
      })

      console.log(
        `Downloaded file from URL: ${url} with status ${response.data}`
      )
      const contentType = response.headers['content-type']?.toLowerCase()

      // Validate content type for CSV or similar
      if (
        !contentType?.includes('text/csv') &&
        !contentType?.includes('application/octet-stream') &&
        !contentType?.includes('text/plain')
      ) {
        throw new BadRequestException(`Invalid content type: ${contentType}`)
      }

      // Check for HTML response (indicates error page or invalid URL)
      if (
        response.data.startsWith('<!DOCTYPE') ||
        response.data.includes('<html')
      ) {
        throw new BadRequestException(
          'Received HTML instead of file content; check URL or access permissions'
        )
      }

      return response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new BadRequestException(
          'Access denied: URL may be restricted or invalid'
        )
      }
      if (error.response?.status === 404) {
        throw new BadRequestException('File not found at the provided URL')
      }
      throw new BadRequestException(`Failed to download file: ${error.message}`)
    }
  }

  async downloadFiles(url: string): Promise<Readable> {
    try {
      if (!url.startsWith('https://')) {
        throw new BadRequestException('Invalid URL: Must start with https://')
      }

      const response = await axios.get(url, {
        responseType: 'stream' // Return the response as a stream
      })

      const contentType = response.headers['content-type']?.toLowerCase()
      // Validate content type for CSV or similar
      if (!contentType?.includes('text/csv') 
        && !contentType?.includes('application/octet-stream') 
        && !contentType?.includes('text/plain')) {
        throw new BadRequestException(`Invalid content type: ${contentType}`)
      }

      // Check if the response is a stream
      if (!(response.data instanceof Readable)) {
        throw new BadRequestException('Response is not a valid stream')
      }

      console.log(`Downloaded file stream from URL: ${url}`)
      return response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new BadRequestException('Access denied: URL may be restricted or invalid')
      }
      if (error.response?.status === 404) {
        throw new BadRequestException('File not found at the provided URL')
      }
      throw new BadRequestException(`Failed to download file: ${error.message}`)
    }
  }
}