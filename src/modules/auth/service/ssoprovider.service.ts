import { Injectable } from '@nestjs/common';
import { type ProviderType } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class SsoProviderService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger()
    private readonly logger: PinoLogger,
  ) { }

  async findSsoProviderByProvider(ssoproviderType: ProviderType) {
    return await this.prisma.ssoProvider.findFirst({
      where: { providerType: ssoproviderType },
    });
  }

  //redirectUrlPathToMatch like "/integrations/google-sheets/callback"
  findSsoProviderByProviderAndRedirectUrl(ssoproviderType: ProviderType, redirectUrlPathToMatch: string) {
    return this.prisma.ssoProvider.findFirst({
      where: { providerType: ssoproviderType, redirectUrl: { contains: redirectUrlPathToMatch }, },
    });
  }
}
