/* eslint-disable prettier/prettier */
import { returnSuccess } from '@/common/helpers/response-handler.helper';
import { PrismaService } from 'nestjs-prisma';
import {
  BillingPackageRequestDto,
  CreateBillingPackageDto,
  DeleteBillingPackageDto,
  UpdateBillingPackageDto,
} from './dto/create.billing-package';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { getAgency } from '@/common/helpers/default-agency-role-id.helper';
import { DEFAULT_AGENCY_NAME } from '@/utils/global-constant';
import { LoginUser } from '../auth/dto/login-user.dto';
import { BillingPackageStatus, CyclePeriod, RequestStatus, RequestType, UserPackageStatus, UserRequest, UserStatus } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) { }

  async getAllBillingPackages() {
    type BillingPackageWithUsageRaw = {
      id: number;
      name: string;
      status: string;
      cyclePeriod: string;
      chargeAmount: string; // comes as string from DB
      trialFreeCredit: number;
      usedByActiveUser: boolean;
    };
    type BillingPackageWithUsage = {
      id: number;
      name: string;
      status: string;
      cyclePeriod: string;
      chargeAmount: number; // converted to number
      trialFreeCredit: number;
      usedByActiveUser: number; // 1 or 0 instead of boolean
    };
    const rawPackages: BillingPackageWithUsageRaw[] = await this.prisma
      .$queryRaw`
            SELECT
                bp.id as id,
                bp.name as name,
                bp.status as status,
                bp.agency_id as agencyId,
                bp.cycle_period as cyclePeriod,
                bp.charge_amount as chargeAmount,
                bp.trial_free_credit as trialFreeCredit,
                CASE 
                WHEN EXISTS (
                    SELECT 1
                    FROM user_packages up
                    JOIN users u ON up.user_id = u.id
                    WHERE
                    up.package_id = bp.id
                    AND up.status = 'ACTIVE'
                    AND u.status = 'ACTIVE'
                )
                THEN TRUE ELSE FALSE END AS usedByActiveUser
            FROM billing_packages bp
                WHERE bp.status != 'DELETED'
            `;
    // Convert strings to numbers
    const packages: BillingPackageWithUsage[] = rawPackages.map((pkg) => ({
      ...pkg,
      chargeAmount: parseFloat(pkg.chargeAmount),
      usedByActiveUser: pkg.usedByActiveUser ? 1 : 0, // convert boolean to 1/0 if you want
    }));
    return returnSuccess(200, 'SUCCESS', packages);
  }

  async getBillingPackages() {
    type BillingPackageWithUsageRaw = {
      id: number;
      name: string;
      status: string;
      cyclePeriod: string;
      chargeAmount: string; // comes as string from DB
      trialFreeCredit: number;
      usedByActiveUser: boolean;
    };
    type BillingPackageWithUsage = {
      id: number;
      name: string;
      status: string;
      cyclePeriod: string;
      chargeAmount: number; // converted to number
      trialFreeCredit: number;
      usedByActiveUser: number; // 1 or 0 instead of boolean
    };
    const rawPackages: BillingPackageWithUsageRaw[] = await this.prisma
      .$queryRaw`
            SELECT
                bp.id as id,
                bp.name as name,
                bp.agency_id as agencyId,
                bp.status as status,
                bp.cycle_period as cyclePeriod,
                bp.charge_amount as chargeAmount,
                bp.trial_free_credit as trialFreeCredit,
                CASE 
                WHEN EXISTS (
                    SELECT 1
                    FROM user_packages up
                    JOIN users u ON up.user_id = u.id
                    WHERE
                    up.package_id = bp.id
                    AND up.status = 'ACTIVE'
                    AND u.status = 'ACTIVE'
                )
                THEN TRUE ELSE FALSE END AS usedByActiveUser
            FROM billing_packages bp
            WHERE bp.status = 'ACTIVE'
            `;
    // Convert strings to numbers
    const packages: BillingPackageWithUsage[] = rawPackages.map((pkg) => ({
      ...pkg,
      chargeAmount: parseFloat(pkg.chargeAmount),
      usedByActiveUser: pkg.usedByActiveUser ? 1 : 0, // convert boolean to 1/0 if you want
    }));
    return returnSuccess(200, 'SUCCESS', packages);
  }

  async createBillingPackage(user: LoginUser, dto: CreateBillingPackageDto) {
    const isSuperAdmin = (user?.roleName ?? '').toLowerCase() === 'super_admin';

    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'You are not authorized to view billing packages.',
      );
    }

    const existingBillingPackage = await this.prisma.billingPackage.findFirst({
      where: {
        name: dto.name,
        status: BillingPackageStatus.ACTIVE,
      },
    });

    if (existingBillingPackage) {
      throw new Error('Billing Package with this name already exists.');
    }

    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    const billingPackage = await this.prisma.billingPackage.create({
      data: {
        name: dto.name,
        agencyId: agency.id,
        status: dto.status ?? BillingPackageStatus.ACTIVE,
        cyclePeriod: dto.cyclePeriod,
        chargeAmount: dto.chargeAmount,
        trialFreeCredit: dto.trialFreeCredit ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return returnSuccess(200, 'Billing Package Created Successfully!', {
      billingPackage,
    });
  }

  async archiveBillingPackage(user: LoginUser, dto: BillingPackageRequestDto) {
    const isSuperAdmin = (user?.roleName ?? '').toLowerCase() === 'super_admin';

    if (!isSuperAdmin) {
      throw new Error(
        'You are not authorized to edit billing packages.',
      );
    }

    const existingBillingPackage = await this.prisma.billingPackage.update({
      where: {
        id: dto.id, // 👈 your billing package ID here
      },
      data: {
        status: BillingPackageStatus.INACTIVE, // 👈 update status
      },
    });

    if (!existingBillingPackage) {
      throw new Error('Error to update billing package.');
    }

    return returnSuccess(200, 'Billing Package Created Successfully!', {
      existingBillingPackage,
    });
  }

  async activateBillingPackage(user: LoginUser, dto: BillingPackageRequestDto) {
    const isSuperAdmin = (user?.roleName ?? '').toLowerCase() === 'super_admin';

    if (!isSuperAdmin) {
      throw new Error(
        'You are not authorized to edit billing packages.',
      );
    }

    const existingBillingPackage = await this.prisma.billingPackage.update({
      where: {
        id: dto.id, // 👈 your billing package ID here
      },
      data: {
        status: BillingPackageStatus.ACTIVE, // 👈 update status
      },
    });

    if (!existingBillingPackage) {
      throw new Error('Error to update billing package.');
    }

    return returnSuccess(200, 'Billing Package Created Successfully!', {
      existingBillingPackage,
    });
  }

  async updateBillingPackage(user: LoginUser, data: UpdateBillingPackageDto) {
    const isSuperAdmin = (user?.roleName ?? '').toLowerCase() === 'super_admin';

    if (!isSuperAdmin) {
      throw new Error(
        'You are not authorized to view billing packages.',
      );
    }

    const existingBillingPackage = await this.prisma.billingPackage.findFirst({
      where: {
        name: data.name,
        NOT: { id: data.id },
      },
    });

    if (existingBillingPackage) {
      throw new Error('Billing Package with this name already exists.');
    }

    const billingPackageData = await this.prisma.billingPackage.findFirst({
      where: {
        id: data.id,
      },
    });

    if (!billingPackageData) {
      throw new Error('Billing Package not found.');
    }

    const billingPackage = await this.prisma.billingPackage.update({
      where: { id: data.id },
      data: {
        name: data.name,
        status: data.status ?? BillingPackageStatus.ACTIVE,
        cyclePeriod: data.cyclePeriod,
        chargeAmount: data.chargeAmount,
        trialFreeCredit: data.trialFreeCredit ?? 0,
        updatedAt: new Date()
      },
    });

    return returnSuccess(200, 'Billing Package Update Successfully!', {
      billingPackage,
    });
  }

  async deleteBillingPackage(user: LoginUser, data: DeleteBillingPackageDto) {
    const isSuperAdmin = (user?.roleName ?? '').toLowerCase() === 'super_admin';

    if (!isSuperAdmin) {
      throw new Error(
        'You are not authorized to view billing packages.',
      );
    }

    const billingPackageData = await this.prisma.billingPackage.findFirst({
      where: {
        id: data.id,
      },
    });

    if (!billingPackageData) {
      throw new Error('Billing Package not found.');
    }

    const billingPackage = await this.prisma.billingPackage.update({
      where: { id: data.id },
      data: {
        status: BillingPackageStatus.DELETED,
      },
    });

    return returnSuccess(200, 'Billing Package Deleted Successfully!', {
      billingPackage,
    });
  }

  async getAccountOverview(user: LoginUser) {
    const userId = user.id;
    const now = new Date();

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 3. Get user's active package
    const [userPackage] = await this.prisma.$queryRawUnsafe<{
      id: null;
      package_id: number;
      next_billing_date: string;
      name: string;
      status: string;
      charge_amount: number;
    }[]>(`
      SELECT 
        up.id,
        up.package_id,
        up.next_billing_date,
        bp.name,
        up.status,
        bp.charge_amount
      FROM user_packages up
      JOIN billing_packages bp ON up.package_id = bp.id
      WHERE up.user_id = ? AND up.status IN ('ACTIVE', 'TRIALING')
      ORDER BY up.next_billing_date DESC
      LIMIT 1
    `, userId);

    const currentUserCount = await this.prisma.user.count({
      where: {
        parentUserId: user.parentUserId ?? user.id,
        status: {
          in: [UserStatus.ACTIVE, UserStatus.PENDING, UserStatus.NEED_TO_RESET_CREDENTIAL]
        }
      }
    });

    let remainingDays: number | null = null;

    if (userPackage?.next_billing_date) {
      const today = new Date();
      const nextBilling = new Date(userPackage.next_billing_date);
      const diff = nextBilling.getTime() - today.getTime();
      remainingDays = Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
    }

    // 4. ManualTopUp sum for current month
    const [manualTopUp] = await this.prisma.$queryRawUnsafe<{ total_amount: number | null }[]>(`
        SELECT SUM(credit_amount) AS total_amount
        FROM billing_transactions
        WHERE user_id = ?
          AND transaction_for = 'ManualTopUp'
          AND created_at BETWEEN ? AND ?
    `, userId, currentMonthStart, currentMonthEnd);

    return {
      userId: userId,
      package: {
        id: userPackage?.id || null,
        packageId: userPackage?.package_id || null,
        nextBillingDate: userPackage?.next_billing_date || null,
        packageName: userPackage?.name || null,
        status: userPackage?.status || null,
        chargeAmount: userPackage?.charge_amount || 0,
        remainingDays
      },
      currentUsers: {
        currentUserCount
      },
      manualTopUp: {
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        totalAmount: Number(manualTopUp?.total_amount || 0),
      },
    };
  }

  async updateUserPackage(user: LoginUser, dto: BillingPackageRequestDto) {

    const userPackageData = await this.prisma.userPackage.findFirst({
      where: {
        userId: user.id,
        status: { in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING] },
      },
      select: {
        packageId: true,
        nextBillingDate: true,
      }
    });

    if (!userPackageData) {
      throw new Error("User Package not found.");
    }

    const scheduleAt = new Date(userPackageData.nextBillingDate);
    scheduleAt.setDate(scheduleAt.getDate() - 1);
    scheduleAt.setHours(23, 40, 0, 0);

    let requestData: UserRequest = null;

    requestData = await this.prisma.userRequest.findFirst({
      where: {
        userId: user.id,
        type: RequestType.CHANGE_PACKAGE_PLAN,
        status: RequestStatus.QUEUE,
      }
    });

    if (requestData) {

      await this.prisma.userRequest.update({
        where: {
          id: requestData.id
        },
        data: {
          requestAt: new Date(),
          scheduleAt: scheduleAt,
          requestBody: {
            packageId: dto.id
          },
        }
      });

    } else {
      requestData = await this.prisma.userRequest.create({
        data: {
          userId: user.parentUserId ?? user.id,
          agencyId: user.agencyId,
          createdBy: user.id,
          type: RequestType.CHANGE_PACKAGE_PLAN,
          requestAt: new Date(),
          scheduleAt: scheduleAt,
          requestBody: {
            packageId: dto.id
          },
          status: RequestStatus.QUEUE,
          message: 'Change package plan request has been queued.'
        }
      });
    }

    if (!requestData) {

      return {
        success: false,
        message: "Oops! An error occurred. Please try again or contact support.",
      };

    }

    return {
      success: true,
      message: "Change package plan request has been queued.",
      requestId: requestData.id,
    };
  }

  async getQueuedRequestsScheduledForToday() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    console.log("startOfDay===============", startOfDay);
    console.log("endOfDay===============", endOfDay);

    const queuedRequests = await this.prisma.userRequest.findMany({
      where: {
        status: RequestStatus.QUEUE,
        type: RequestType.CHANGE_PACKAGE_PLAN,
        scheduleAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        userId: true,
        requestBody: true,
        scheduleAt: true,
        requestAt: true,
        message: true,
      },
    });

    console.log("queuedRequests===============", queuedRequests);

    const failedRequests: { id: number; error: string }[] = [];
    let successCount = 0;

    for (const request of queuedRequests) {
      try {
        const updatedRequest = await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.PROCESSING,
            message: 'Processing change package request...',
          },
        });

        console.log("updatedRequest===============", updatedRequest);

        let packageId: number | undefined;
        if (typeof request.requestBody === 'object' && request.requestBody !== null) {
          packageId = (request.requestBody as any).packageId;
        } else if (typeof request.requestBody === 'string') {
          const parsed = JSON.parse(request.requestBody);
          packageId = parsed.packageId;
        }

        if (!packageId) {
          console.log("packageId not found in requestBody.");
        }

        const packageData = await this.prisma.billingPackage.findUnique({
          where: { id: packageId },
        });

        if (!packageData) {
          throw new Error('Invalid package ID');
        }

        const cyclePeriod = packageData.cyclePeriod as CyclePeriod; // ensure correct type

        const now = new Date();
        const nextBillingDate = new Date(now);

        if (cyclePeriod === CyclePeriod.MONTH) {
          nextBillingDate.setDate(nextBillingDate.getDate() + 29);
        } else if (cyclePeriod === CyclePeriod.YEAR) {
          nextBillingDate.setDate(nextBillingDate.getDate() + 364);
        } else if (cyclePeriod === CyclePeriod.LIFE_TIME) {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 100);
        }

        const updatedPackages = await this.prisma.userPackage.updateMany({
          where: {
            userId: request.userId,
            status: { in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING] },
          },
          data: {
            packageId: packageId,
            nextBillingDate: nextBillingDate,
          },
        });

        console.log("updatedPackages===============", updatedPackages);

        const updatedRequest2 = await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.PROCESSED,
            message: 'Change package plan request has been processed successfully.',
          },
        });

        console.log("updatedRequest2===============", updatedRequest2);

        successCount++;
      } catch (error: any) {
        console.error(`Failed to process request ${request.id}:`, error);

        await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.FAILED,
            message: `Failed to process request: ${error.message}`,
          },
        });

        failedRequests.push({
          id: Number(request.id),
          error: error.message,
        });
      }
    }

    return {
      success: true,
      total: queuedRequests.length,
      successCount,
      failureCount: failedRequests.length,
      failedRequests,
    };
  }
}
