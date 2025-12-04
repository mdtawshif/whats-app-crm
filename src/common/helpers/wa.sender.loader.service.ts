import { Injectable } from "@nestjs/common";
import { InboxInOut, WaNumberStatus } from "@prisma/client";
import { from } from "form-data";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class WaSenderLoaderService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(WaSenderLoaderService.name);
  }

  async loadSenderWaNumber(agencyId: bigint, userId: bigint, contactId: bigint, senderNumber?: string) {
    //  use user provided sender number
    if (senderNumber && typeof senderNumber === 'string' && senderNumber?.toString()?.trim().length > 7 && senderNumber?.toString()?.trim().length < 18) {
      const waNumber = await this.prisma.waBusinessNumber.findFirst({
        where: {
          agencyId,
          userId,
          numberStatus: WaNumberStatus.VERIFIED,
          OR: [
            { number: senderNumber },
            { displayPhoneNumber: senderNumber },
          ],
        },
      });

      return waNumber;
    }


    const lastConversation = await this.prisma.conversation.findFirst({
      where: {
        agencyId,
        userId,
        contactId,
        inOut: InboxInOut.OUT
      },
      select: {
        fromNumber: true
      },
      orderBy: { id: 'desc' }
    })

    if (lastConversation && lastConversation.fromNumber) {
      const waNumber = await this.prisma.waBusinessNumber.findFirst({
        where: {
          agencyId,
          userId,
          number: lastConversation.fromNumber,
          numberStatus: WaNumberStatus.VERIFIED
        }
      })
      if (waNumber) {
        return waNumber;
      }
    }

    const waNumber = await this.prisma.waBusinessNumber.findFirst({
      where: {
        agencyId,
        userId,
        numberStatus: WaNumberStatus.VERIFIED
      }
    })

    return waNumber;
  }


}