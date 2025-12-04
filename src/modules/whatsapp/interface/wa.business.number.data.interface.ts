// import {
//   QualityRating,
//   WaBusinessNumberCodeVerificationStatus,
//   WaBusinessNumberStatus,
// } from '@prisma/client';

// export interface WaBusinessNumberData {
//   agencyId: number;
//   userId: number;
//   teamId: number;
//   phoneNumberId: string;
//   wabaId?: string;
//   verifiedName?: string;
//   displayPhoneNumber?: string;
//   countryCode?: string;
//   number?: string;
//   qualityRating: QualityRating;
//   codeVerificationStatus: WaBusinessNumberCodeVerificationStatus;
//   numberStatus: WaBusinessNumberStatus;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// export function toQualityRating(value: string): QualityRating | undefined {
//   if (value in QualityRating) {
//     return QualityRating[value as keyof typeof QualityRating];
//   }
//   return undefined;
// }

// export function toNumberStatus(
//   value: string,
// ): WaBusinessNumberStatus | undefined {
//   if (value in WaBusinessNumberStatus) {
//     return WaBusinessNumberStatus[value as keyof typeof WaBusinessNumberStatus];
//   }
//   return undefined;
// }

// export function toCodeVrificationStatus(
//   value: string,
// ): WaBusinessNumberCodeVerificationStatus | undefined {
//   if (value in WaBusinessNumberCodeVerificationStatus) {
//     return WaBusinessNumberCodeVerificationStatus[
//       value as keyof typeof WaBusinessNumberCodeVerificationStatus
//     ];
//   }
//   return undefined;
// }
