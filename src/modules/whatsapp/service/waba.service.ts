// import { Injectable } from '@nestjs/common';
// import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
// import { PrismaService } from 'nestjs-prisma';
// import { WhatsAppBusinessAccountCreateRequest } from '../interface/wa.business.account.interface';
// import { WhatsAppBusinessAccountStatus } from '@prisma/client';

// @Injectable()
// export class WaBusinessAccountService {
//   constructor(
//     private readonly prisma: PrismaService,
//     @InjectPinoLogger()
//     private readonly logger: PinoLogger,
//   ) {}

//   async findUserwabaByBusinessId(userId: number, businessId: string) {
//     await this.prisma.whatsAppBusinessAccount.findMany({
//       // where: {userId: userId, fbBusinessId:businessId}
//     });
//   }

//   async addWaba(
//     whatsAppBusinessAccountCreateRequest: WhatsAppBusinessAccountCreateRequest,
//   ) {
//     try {
//       this.prisma.whatsAppBusinessAccount.create({
//         data: {
//           userId: whatsAppBusinessAccountCreateRequest.userId,
//           agencyId: whatsAppBusinessAccountCreateRequest.userId,
//           teamId: whatsAppBusinessAccountCreateRequest.userId,
//           fbBusinessId: whatsAppBusinessAccountCreateRequest.userId,
//           wabaId: whatsAppBusinessAccountCreateRequest.wabaId,
//           name: whatsAppBusinessAccountCreateRequest.name,
//           status:
//             whatsAppBusinessAccountCreateRequest.status ??
//             WhatsAppBusinessAccountStatus.ACTIVE,
//           createdAt:
//             whatsAppBusinessAccountCreateRequest.createdAt ?? new Date(),
//           updatedAt:
//             whatsAppBusinessAccountCreateRequest.updatedAt ?? new Date(),
//         },
//       });
//     } catch (error) {
//       this.logger.error(error);
//     }
//   }
// }
