import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class FbBusinessAccountService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(FbBusinessAccountService.name)
    private readonly logger: PinoLogger,
  ) { }

  async findByUser(userId: bigint) {

    console.log('userId', userId);
    
    const fbBusinessAccounts = await this.prisma.fbBusinessAccount.findMany({
      where: { userId: userId },
      include: {
        waAccounts: {
          where: { userId: userId },   // 👈 filter WA accounts by same userId
          include: {
            waNumbers: {
              where: { userId: userId },   // 👈 filter WA numbers by same userId
              include: {
                metaOauthToken: {
                  where: { userId: userId }   // 👈 filter MetaOauthToken by same userId
                }
              }
            }
          }
        }
      }
    });

    console.log('fbBusinessAccounts', fbBusinessAccounts);

    return fbBusinessAccounts;

  }


  async findFBBusinessAccountById(id: bigint) {
    if (id == null) {
      return null;
    }
    try {
      return this.prisma.fbBusinessAccount.findFirst({
        where: {
          id: id
        }
      })
    } catch (error) {
      /** */
    }
  }

}
