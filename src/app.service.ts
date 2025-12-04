import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { checkS3Connection } from './utils/s3-utility';
import S3Multipart, {
  getS3MultipartClient,
} from './utils/custom-s3-multipart-utility';
import { Redis } from 'ioredis';

@Injectable()
export class AppService {
  s3MultipartClient: S3Multipart;

  constructor(private readonly prisma: PrismaService) {
    this.s3MultipartClient = getS3MultipartClient();
  }

  checkSystemStatus(): { message: string } {
    return { message: 'OK, everything is up and running.' };
  }

  getHealth(): { message: string } {
    return { message: 'OK' };
  }

  async getHealthDetails(): Promise<{
    status: string;
    message: string;
    details: any;
  }> {
    const allStatus = await Promise.allSettled([
      this.checkService('Prisma', this.checkPrisma()),
      this.checkService('Redis', this.checkRedis()),
      this.checkService('Aws S3', this.checkAwsS3()),
      this.checkService('R2 S3', this.checkR2S3()),
    ]);

    let overolStatus = 'UP';

    const details = allStatus.reduce((acc, result) => {
      const { value, status }: any = result;
      if (status === 'fulfilled' && value.status === true) {
        acc[value.serviceName] = {
          isOkay: value.status,
        };
      } else {
        overolStatus = 'DOWN';
        acc[value.serviceName] = {
          isOkay: false,
          error: value.status,
        };
      }
      return acc;
    }, {});

    const response = {
      status: overolStatus,
      message: `All services are ${overolStatus === 'DOWN' ? 'not ' : ''}healthy`,
      details: overolStatus === 'DOWN' ? details : undefined,
    };
    if (overolStatus === 'UP') return response;
    throw new HttpException(response, 400);
  }

  private async checkService(
    serviceName: string,
    checkFunction: Promise<boolean | string>,
  ): Promise<{
    serviceName: string;
    status: boolean | string;
    error?: string;
  }> {
    try {
      const status = await checkFunction;
      return { serviceName, status };
    } catch (error) {
      return { serviceName, status: error.message };
    }
  }

  private async checkPrisma(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return error.message;
    }
  }

  private async checkRedis(): Promise<boolean | string> {
    let password: string;

    const useRedisPassword = process.env.REDIS_USE_PASSWORD === 'yes';
    if (useRedisPassword) {
      password = process.env.REDIS_PASSWORD;
    }

    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: +process.env.REDIS_PORT,
      password,
    }); // Create a new Redis client

    try {
      // Set a test key-value pair
      await redis.set('healthCheck', 'OK');

      // Get the value of the test key
      const value = await redis.get('healthCheck');

      // If the value is "OK", the connection is successful
      if (value === 'OK') return true;

      console.error('Unexpected value received from Redis:', value);
      return 'Unexpected value received from Redis:';
    } catch (error) {
      console.error('Error connecting to Redis:', error);
      return error.message;
    } finally {
      await redis.del('healthCheck');
      // Close the Redis connection
      redis.quit();
    }
  }

  private async checkAwsS3(): Promise<boolean> {
    try {
      return await checkS3Connection();
    } catch (error) {
      return error.message;
    }
  }

  private async checkR2S3(): Promise<boolean> {
    try {
      return await this.s3MultipartClient.checkS3Connection();
    } catch (error) {
      return error.message;
    }
  }
}
