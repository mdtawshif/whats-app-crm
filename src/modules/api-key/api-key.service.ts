import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { PinoLogger } from 'nestjs-pino';
import { ApiKeyUtils } from "@/utils/api-key-generator";

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) { }

  async generateApiKey(userId: number): Promise<string> {
    try {

      const apiKey = ApiKeyUtils.generateApiKey({
        prefix: 'sk_',
        length: 32,
        includeTimestamp: true,
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { apiKey },
      });

      return apiKey;

    } catch (error) {
      this.logger.error(`Failed to generate API key: ${error.message}`);
      throw new BadRequestException('Failed to generate API key');
    }
  }
  
}