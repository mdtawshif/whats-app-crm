import { phoneNumberRequestCode, phoneNumberVerifyCode } from '@/common/wa-helper/wa-helper';
import { SearchUtils } from '@/utils/search.utils';
import { Injectable } from '@nestjs/common';
import { CodeVerificationStatus, WaNumberStatus, type Prisma } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import type { GetWaBusinessNumbersDto } from '../dto/get-wa-business-numbers.dto';
import { normalizePhoneNumber } from '@/utils/phone-numbers/format-phone-number';

@Injectable()
export class WaBusinessNumberService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(WaBusinessNumberService.name)
    private readonly logger: PinoLogger,
  ) { }
  /**
     * Determines the sender number (fromNumber) and associated phoneNumberId for WhatsApp Business.
     * Prioritizes the provided phoneNumberId if given; otherwise, falls back to the first matching number for the agency/user.
     * Throws an error if no suitable number is found.
     * @param agencyId The agency ID.
     * @param userId The user ID.
     * @param phoneNumberId Optional phoneNumberId from DTO to use specifically.
     * @returns { fromNumber: string, phoneNumberId: string }
     * @throws Error if no WA business number is found.
     */
  async determineSenderNumber(
    { agencyId,
      userId,
      phoneNumberId
    }:
      {
        agencyId: bigint,
        userId: bigint,
        phoneNumberId?: string
      }
  ): Promise<{ fromNumber: string; phoneNumberId: string }> {
    this.logger.info('Determining sender number', { agencyId, userId, phoneNumberId });

    console.log({ phoneNumberId, userId, agencyId });
    const whereClause = phoneNumberId
      ? { phoneNumberId, userId, agencyId }
      : { agencyId, userId };

    const waNumber = await this.prisma.waBusinessNumber.findFirst({
      where: { ...whereClause, numberStatus: WaNumberStatus.VERIFIED }, // Assuming VERIFIED is your active status; swap if ACTIVE
      select: { number: true, phoneNumberId: true },
    });

    if (!waNumber) {
      const errorMsg = phoneNumberId
        ? `No WhatsApp business number found with ID: ${phoneNumberId}`
        : `No WhatsApp business number found for agency ID: ${agencyId} and user ID: ${userId}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    return {
      fromNumber: normalizePhoneNumber(waNumber.number),
      phoneNumberId: waNumber.phoneNumberId,
    };
  }

  async getWaBusinessNumbers(
    user: LoginUser,
    query: GetWaBusinessNumbersDto,
  ) {
    this.logger.info(
      'Fetching WA business numbers for user %s with query: %o',
      user.id,
      query,
    );

    const { query: search, limit = 20, page = 1, status } = query;
    const skip = (page - 1) * limit;

    // Build base where clause
    const baseWhere: Prisma.WaBusinessNumberWhereInput = {
      agencyId: user.agencyId,
      userId: user.id,
    };

    // Apply status filter if provided
    if (status) baseWhere.numberStatus = status as any; // Cast to enum if needed

    // Apply search if provided
    const where = search
      ? SearchUtils.applySearch<Prisma.WaBusinessNumberWhereInput>(
        baseWhere,
        search,
        {
          fields: ['displayPhoneNumber', 'number', 'verifiedName'],
          strategy: 'ALL',
          minTermLength: 2,
          maxTerms: 5,
          caseSensitive: false,
        },
      )
      : baseWhere;

    const [data, total] = await Promise.all([
      this.prisma.waBusinessNumber.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.waBusinessNumber.count({ where }),
    ]);

    const nextPage = total > page * limit ? page + 1 : null;

    // Format data minimally for frontend
    const formattedData = data.map((number) => ({
      id: number.id.toString(),
      phoneNumberId: number.phoneNumberId,
      verifiedName: number.verifiedName,
      displayPhoneNumber: number.displayPhoneNumber,
      number: number.number,
      qualityRating: number.qualityRating,
      codeVerificationStatus: number.codeVerificationStatus,
      numberStatus: number.numberStatus,
      createdAt: number.createdAt,
      updatedAt: number.updatedAt,
      pinCode: number.pinCode,
      isRegister: number.isRegister,
    }));

    return {
      data: formattedData,
      nextPage,
      total,
    };
  }

  async getNumberDataById(id: bigint) {
    return this.prisma.waBusinessNumber.findFirst({
      where: {
        id: id
      },
      select: {
        phoneNumberId: true,
        waBusinessAccountId: true,
        number: true,
        numberStatus: true,
        wabaAccount: {
          select: {
            id: true,
            wabaId: true
          }
        },
        metaOauthTokenId: true
      }
    })
  }

  async sendVerificationCode(id: bigint, user: LoginUser, type: "VOICE" | "SMS" = "SMS") {
    /* get phone number info by id */
    const fullData = await this.prisma.waBusinessNumber.findFirst({
      where: {
        id: id
      },
      select: {
        phoneNumberId: true,
        metaOauthTokenId: true,
        metaOauthToken: {
          select: {
            accessToken: true
          }
        }
      }
    })
    /* send code */
    await phoneNumberRequestCode(fullData.phoneNumberId, fullData.metaOauthToken.accessToken, type);
  }

  async verifyCode(id: bigint, user: LoginUser, code: string) {
    /* get phone number info by id */
    const fullData = await this.prisma.waBusinessNumber.findFirst({
      where: {
        id: id
      },
      select: {
        phoneNumberId: true,
        metaOauthTokenId: true,
        metaOauthToken: {
          select: {
            accessToken: true
          }
        }
      }
    })
    /* send code */
    const res = await phoneNumberVerifyCode(fullData.phoneNumberId, fullData.metaOauthToken.accessToken, code);
    if (res) {
      await this.prisma.waBusinessNumber.update({
        where: {
          id: id
        },
        data: {
          pinCode: code,
          codeVerificationStatus: CodeVerificationStatus.VERIFIED
        }
      })
      return true;
    }
    return false;
  }

  async getWaNumberDataById(id: bigint) {
    return await this.prisma.waBusinessNumber.findFirst({
      where: {
        id
      }
    })
  }
}
