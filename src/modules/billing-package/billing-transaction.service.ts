/* eslint-disable prettier/prettier */
import { returnSuccess } from '@/common/helpers/response-handler.helper'
import { PrismaService } from 'nestjs-prisma'
import {
  BillingTransactionResponse,
} from './dto/create.billing-package'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { getAgency } from '@/common/helpers/default-agency-role-id.helper'
import { DEFAULT_AGENCY_NAME } from '@/utils/global-constant'
import { LoginUser } from '../auth/dto/login-user.dto'
import {
} from '@prisma/client'
import { of } from 'rxjs'

@Injectable()
export class BillingTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserTransations(userId: bigint, currentPage: number, perPage:number): Promise<{ total: number; data: BillingTransactionResponse[] }> {

    const offset = (currentPage - 1) * perPage;
    const query = `
      SELECT 
        id, 
        credit_amount AS chargeAmount,
        IF(type = 'out', 'Outgoing Message', 'Incoming Message') AS chargeType,
        transaction_for AS chargePurpose,
        note AS chargeNote,
        created_at AS chargedAt
      FROM billing_transactions
      WHERE user_id = ${userId}
      LIMIT ${perPage} OFFSET ${offset}
    `

    const countQuery = `SELECT count(*) AS total FROM billing_transactions where user_id = ${userId}`;
    const [data, countResult] = await Promise.all([
          this.prisma.$queryRawUnsafe<BillingTransactionResponse[]>(query),
          this.prisma.$queryRawUnsafe<{ total: number }[]>(countQuery),
    ]);
    
    // return await this.prisma.$queryRawUnsafe(query);
    console.log("total: ", countResult[0]);
    return {
      total: countResult[0]?.total || 0,
      data,
    };
  }
}
