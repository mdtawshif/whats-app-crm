import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import {
  returnError,
  returnSuccess,
} from '../../common/helpers/response-handler.helper';
import { MyProfileDto } from './dto/get-user.dto';
import {
  AutoRechargeDto,
  AutoRechargeSettingsDto,
  UpdateUserProfileDto,
} from './dto/update-user.dto';
import { AutoRechargeStatus, BillingPackage, CyclePeriod, Prisma, TeamRole, TransactionType, User, UserPackage, UserPackageRenewHistoryStatus, UserPackageStatus } from '@prisma/client';
import Stripe from 'stripe';
import { LoginUser } from '../auth/dto/login-user.dto';
import { ActivateUserDto, BasicUser } from './dto/user.dto';
import { PackageRenewUserCardInfo } from '../payment/dto/package-renew.dto';
import { EmailService } from '../email/email.service';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { UserListItemDto, UserListParamDto } from './dto/user-list-item-dto';
import { RoleDTO } from '@/utils/RoleDTO';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
    private readonly emailService: EmailService,
  ) { }

  async userList(
    authUser: LoginUser,
    query: UserListParamDto
  ): Promise<ApiListResponseDto<UserListItemDto>> {
    const {
      page = 1,
      perPage = 10,
      sortOn,
      sortDirection = 'desc',
      query: searchQuery,
      needPagination = true,
    } = query;

    console.log(searchQuery);

    // Build search without `mode` for compatibility
    const searchOr = searchQuery
      ? [
        { email: { contains: searchQuery } },
        { userName: { contains: searchQuery } },
        { phone: { contains: searchQuery } },
      ]
      : undefined;

    console.log(searchOr);

    const where: any = {
      agencyId: authUser.agencyId,
      parentUserId: authUser.id, // 👈 filter only users under this parent
      ...(searchOr ? { OR: searchOr } : {}),
    };

    // Fallback to createdAt when sortOn is not provided
    const orderBy: any = sortOn ? { [sortOn]: sortDirection } : { createdAt: 'desc' };

    try {
      let rows: any[] = [];
      let total = 0;

      if (needPagination) {
        [rows, total] = await this.prisma.$transaction([
          this.prisma.user.findMany({
            where,
            orderBy,
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
              role: true,
            }
          }),
          this.prisma.user.count({ where }),
        ]);
      } else {
        rows = await this.prisma.user.findMany({
          where,
          orderBy
        });
        total = rows.length;
      }

      console.log(rows);
      console.log(where);

      const data: UserListItemDto[] = rows.map((u) => ({
        id: u.id,
        agencyId: u.agencyId ?? null,
        roleId: u.roleId ?? null,
        userName: u.userName ?? null,
        email: u.email,
        phone: u.phone ?? null,
        isMailVerified: u.isMailVerified,
        status: u.status,
        currentCredit: (u.currentCredit as unknown as Prisma.Decimal).toString(), // Decimal -> string
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        roleName: u.role?.name ?? null,
      }));

      const response: ApiListResponseDto<UserListItemDto> = {
        statusCode: 200,
        message: 'Users fetched successfully.',
        data,
      };

      if (needPagination) {
        response.pagination = {
          total,
          perPage,
          currentPage: page,
          totalPages: Math.ceil(total / perPage),
          nextPage: page * perPage < total ? page + 1 : undefined,
          prevPage: page > 1 ? page - 1 : undefined,
        };
      }

      return response;
    } catch (error) {
      // optional: console.error(error);
      throw new HttpException(
        'An unexpected error occurred while fetching users.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async myProfile(user: MyProfileDto) {
    const query = Prisma.sql`
      SELECT 
        e.id,
        e.user,
        e.email,
        e.currentCredit, 
        t.name as team_name
      FROM users e
      LEFT JOIN teams t ON e.team_id = t.id
      WHERE e.id = ${user.id}
    `;

    const userInfo = await this.prisma.$queryRaw(query);

    if (!userInfo || !userInfo[0]) {
      return returnError(404, 'User profile not found');
    }

    const responseData = {
      ...userInfo[0],
    };

    return returnSuccess(200, 'Profile data fetched', responseData);
  }

  async updateUserProfile(user: LoginUser, data: UpdateUserProfileDto) {
    // Check if the user exists
    const userInfo = await this.prisma.user.findUnique({
      where: {
        id: Number(data.id),
      },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    // Update only the allowed fields
    const updatedUser = await this.prisma.user.update({
      where: {
        id: Number(data.id),
      },
      data: {
        userName: data.user_name,
        phone: data.phone,
      },
    });


    return {
      message: 'User profile updated successfully',
      data: {
        ...updatedUser,
        name: updatedUser.userName,
      },
    };
  }

  async enableAutoRecharge(user: LoginUser, data: AutoRechargeDto) {
    // Check if the user exists
    const userInfo = await this.prisma.user.findUnique({
      where: {
        id: Number(user.id),
      },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: Number(user.id),
      },
      data: {
        autoRecharge: data.autoRecharge,
        autoRechargeAmount: data.autoRechargeAmount,
        minimumCreditThreshold: data.minimumCreditThreshold,
      },
    });

    const parsedUpdatedUser = {
      ...updatedUser,
      autoRechargeAmount: Number(updatedUser.autoRechargeAmount),
      minimumCreditThreshold: Number(updatedUser.minimumCreditThreshold),
    };

    return {
      message: 'Successfully updated auto recharge',
      data: {
        ...parsedUpdatedUser,
      },
    };
  }

  async getAutoRechargeInfo(user: LoginUser) {
    const query = Prisma.sql`
      SELECT 
        e.id,
        e.autoRecharge,
        e.auto_recharge_amount as autoRechargeAmount,
        e.minimum_credit_threshhold as minimumCreditThreshold
      FROM users e
      WHERE e.id = ${user.id}
    `;

    const userInfo = await this.prisma.$queryRaw(query);

    if (!userInfo || !userInfo[0]) {
      return returnError(400, 'User profile not found');
    }

    const responseData = {
      ...userInfo[0],
    };

    const parsedResponseData = {
      ...responseData,
      autoRechargeAmount: Number(responseData.autoRechargeAmount),
      minimumCreditThreshold: Number(responseData.minimumCreditThreshold),
    };

    return returnSuccess(200, 'Profile data fetched', parsedResponseData);
  }

  async getAdmins(user: LoginUser) {
    const admins = await this.prisma.$queryRaw<any[]>`
      SELECT 
        u.id AS userId,
        u.user_name AS userName,
        u.email AS email,
        u.phone AS phone,
        u.status AS status,
        u.parent_id AS parentId,
        u.team_id AS teamId,
        u.role_id AS roleId,
        u.current_credit_amount AS currentCreditAmount,
        u.autoRecharge AS autoRecharge,
        u.auto_recharge_amount AS autoRechargeAmount,
        u.minimum_credit_threshhold AS minimumCreditThreshold,
        r.name AS roleName
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE u.status = 'ACTIVE'
        AND u.parent_id IS NULL
        AND r.name = 'Administrator'
    `;

    return returnSuccess(200, 'Admin users fetched successfully', admins);
  }

  async updateAutoRechargeSettings(
    user: LoginUser,
    dto: AutoRechargeSettingsDto,
  ) {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        autoRechargeAmount: dto.autoRechargeAmount,
        minimumCreditThreshold: BigInt(dto.minimumCreditThreshold),
      },
    });

    return {
      message: 'Auto recharge settings updated successfully',
      data: {
        autoRechargeAmount: Number(updatedUser.autoRechargeAmount),
        minimumCreditThreshold: Number(updatedUser.minimumCreditThreshold),
      },
    };
  }

  async getUserCardInfo(user: LoginUser) {
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const cardInfo = await this.prisma.userCardInfo.findFirst({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        cardNumber: true,
        cardBrand: true,
        cardExpMonth: true,
        cardExpYear: true,
      },
    });

    if (!cardInfo) {
      return returnError(400, 'User card info not found');
    }

    return returnSuccess(200, 'User card info fetched successfully', {
      cardInfo,
    });
  }

  //  New methods added
  async findById(id: bigint) {
    const userData = await this.prisma.user.findUnique({ where: { id } });
    // if parentUserId is null, set it to user id (self reference)
    if (!userData.parentUserId) {
      userData.parentUserId = userData.id;
    }
    return userData;
  }

  /**
 * Base query to fetch user IDs from the database.
 * @param where Prisma filter conditions.
 * @returns List of user IDs.
 */
  private async getUserIds(where: Parameters<typeof this.prisma.user.findMany>[0]["where"]): Promise<bigint[]> {
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** 
   * Get all user IDs within a specific agency.
   */
  async getUserIdsByAgency(agencyId: bigint): Promise<bigint[]> {
    return this.getUserIds({ agencyId });
  }

  /**
   * Get only team leaders and admins from a specific agency.
   */
  async getUserIdsByAgencyOnlyTeamAndAdmins(agencyId: bigint): Promise<bigint[]> {
    return this.getUserIds({
      agencyId,
      role: { name: { in: [RoleDTO.TEAM_LEADER_ROLE_NAME, RoleDTO.ADMIN_ROLE_NAME] } },
    });
  }

  /**
   * Get all user IDs in a specific team of an agency.
   */
  async getUserIdsByTeam(agencyId: bigint, teamId: bigint): Promise<bigint[]> {
    const users = await this.prisma.teamMember.findMany({
      where: {
        agencyId,
        teamId
      },
      select: { memberId: true },
    });
    return users.map((u) => u.memberId);
  }

  /**
   * Get only admin user IDs in an agency.
   */
  async getUserIdsByAgencyAndAdminsOnly(agencyId: bigint): Promise<bigint[]> {
    return this.getUserIds({
      agencyId,
      role: { name: RoleDTO.ADMIN_ROLE_NAME },
    });
  }

  /**
   * Get all user IDs in an agency except admins.
   */
  async getUserIdsByAgencyAndExcludeAdmins(agencyId: bigint): Promise<bigint[]> {
    return this.getUserIds({
      agencyId,
      role: { name: { not: RoleDTO.ADMIN_ROLE_NAME } },
    });
  }

  /**
   * Get only member (non-admin, non-team-leader) user IDs in an agency.
   */
  async getUserIdsByAgencyAndNotAdmins(agencyId: bigint): Promise<bigint[]> {
    return this.getUserIds({
      agencyId,
      role: { name: RoleDTO.MEMBER_ROLE_NAME },
    });
  }

  /**
   * Get only team leader user IDs in a team.
   */
  async getUserIdsByTeamAndAdminsOnly(teamId: bigint): Promise<bigint[]> {
    const users = await this.prisma.teamMember.findMany({
      where: {
        teamId: teamId,
        teamRole: TeamRole.LEADER
      },
      select: { memberId: true, teamRole: true },
    });
    return users.map((u) => u.memberId);
  }

  /**
   * Get all team user IDs excluding admins.
   */
  async getUserIdsByTeamAndExcludeAdmins(teamId: bigint): Promise<bigint[]> {
    const users = await this.prisma.teamMember.findMany({
      where: {
        teamId: teamId,
        teamRole: { not: TeamRole.LEADER }, //  Correct Prisma syntax
      },
      select: { memberId: true, teamRole: true },
    });
    return users.map((u) => u.memberId);
  }


  async activateUser(dto: ActivateUserDto): Promise<{ message: string; status: string }> {

    const userData = await this.prisma.user.findFirst({
      where: { id: dto.userId },
    });

    if (!userData) {
      throw new NotFoundException('User not found.');
    }

    const userPackageData = await this.prisma.userPackage.findFirst({
      where: {
        userId: dto.userId
      }
    });

    if (!userPackageData) {
      throw new NotFoundException('User selected package not found.');
    }

    if (userPackageData.status === UserPackageStatus.ACTIVE) {
      return { message: 'User is already active.', status: 'Fail' };
    }

    if (userPackageData.status != UserPackageStatus.TRIALING) {
      return { message: 'User is already active.', status: 'Fail' };
    }

    const billingPackageData = await this.prisma.billingPackage.findFirst({
      where: {
        id: userPackageData.packageId
      }
    });

    if (!billingPackageData) {
      throw new NotFoundException('User selected package not found.');
    }

    const result: PackageRenewUserCardInfo | null =
      await this.prisma
        .$queryRaw<PackageRenewUserCardInfo[]>`
      SELECT 
        uci.customer_id AS customerId,
        u.id AS userId,
        uci.id AS cardInfoId,
        u.team_id AS teamId,
        up.package_id AS packageId,
        bp.charge_amount AS chargeAmount
      FROM users u
      INNER JOIN user_card_infos uci ON u.id = uci.user_id 
      INNER JOIN user_packages up ON u.id = up.user_id
      INNER JOIN billing_packages bp ON up.package_id = bp.id
      WHERE 
        u.status = 'ACTIVE' 
        AND u.parent_user_id IS NULL 
        AND uci.status = 'ACTIVE' 
        AND up.status = 'TRIALING'
        AND u.id = ${dto.userId}
    `.then(rows => rows[0] ?? null); // safely get the first result

    if (!result) {
      throw new NotFoundException('User selected package not found.');
    }

    let amount: number = 0; // explicitly tell TypeScript it will be a number

    if (result.chargeAmount instanceof Prisma.Decimal) {
      amount = result.chargeAmount.toNumber();
    } else if (typeof result.chargeAmount === "string") {
      amount = parseFloat(result.chargeAmount);
    } else if (typeof result.chargeAmount === "number") {
      amount = result.chargeAmount;
    }

    if (amount <= 0 || isNaN(amount)) {
      console.log("invalid charge amount", amount);
      throw new NotFoundException("invalid charge amount.");
    }

    if (userData.currentCredit.toNumber() >= amount) {
      const userActivationFromCurrentCredit = await this.chargeFromCurrentCredit(userData, result, amount, userPackageData, billingPackageData);
      console.log("userActivationFromCurrentCredit", userActivationFromCurrentCredit);
    } else {
      const packageRenewChargeFromStripeCard = await this.chargeFromStripeCard(userData, result, amount, userPackageData, billingPackageData);
      console.log("packageRenewChargeFromStripeCard", packageRenewChargeFromStripeCard);
      if (!packageRenewChargeFromStripeCard) {
        const packageRenewChargeFromCurrentCredit = await this.chargeFromCurrentCreditForce(userData, result, amount, userPackageData, billingPackageData);
        console.log("packageRenewChargeFromCurrentCredit", packageRenewChargeFromCurrentCredit);
      }
    }

    return { message: 'User transitioned from trial to active.', status: 'Success' };

  }

  async chargeFromCurrentCredit(userData: User, packageRenewUserCardInfoData: PackageRenewUserCardInfo, amount: number, userPackage: UserPackage, billingPackageData: BillingPackage): Promise<boolean> {
    const userInfoExits = await this.prisma.user.findFirst({
      where: {
        id: packageRenewUserCardInfoData.userId
      }
    });

    if (!userInfoExits) {
      throw new NotFoundException('User not found.');
    }

    //Decrement current credit
    await this.prisma.user.update({
      where: {
        id: packageRenewUserCardInfoData.userId
      },
      data: {
        currentCredit: {
          decrement: amount
        }
      }
    });

    //Add user transaction
    const userTransactionData = await this.prisma.billingTransaction.create({
      data: {
        userId: Number(packageRenewUserCardInfoData.userId),
        agencyId: userInfoExits.agencyId,
        createdBy: userInfoExits.id,
        creditAmount: amount,
        billingPackageId: packageRenewUserCardInfoData.packageId,
        type: TransactionType.OUT,
        transactionFor: "PackagePurchase",
      },
    });

    console.log('userTransactionData', userTransactionData);

    //Add user package renew history 
    const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
      data: {
        userId: Number(packageRenewUserCardInfoData.userId),
        agencyId: userInfoExits.agencyId,
        cardInfoId: packageRenewUserCardInfoData.cardInfoId,
        packageId: packageRenewUserCardInfoData.packageId,
        status: UserPackageRenewHistoryStatus.SUCCESS,
        chargeAmount: amount
      },
    });

    console.log('userPackageRenewHistoryData', userPackageRenewHistoryData);

    const updateNextBillingDate = await this.updateNextBillingDate(userPackage, billingPackageData);

    console.log('updateNextBillingDate : ', updateNextBillingDate);

    //Send mail for package renew 
    // const mailSendSuccess = await this.sendPackageRenewSuccessMail(amount, userData);

    // console.log('mailSendSuccess : ', mailSendSuccess);

    return true;
  }

  async chargeFromStripeCard(userData: User, packageRenewUserCardInfoData: PackageRenewUserCardInfo, amount: number, userPackage: UserPackage, billingPackageData: BillingPackage): Promise<boolean> {

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const feePercent = 0.029;
    const feeFixed = 0.3;
    const totalAmount = amount + amount * feePercent + feeFixed;
    const rechargeAmount = Math.round(totalAmount * 100);

    console.log("amount", amount);
    console.log("type of amount ", typeof amount);
    console.log("totalAmount", totalAmount);
    console.log("type of totalAmount ", typeof totalAmount);
    console.log("rechargeAmount", rechargeAmount);
    console.log("type of rechargeAmount ", typeof rechargeAmount);
    console.log(`Charging user ${packageRenewUserCardInfoData.userId} an amount of ${totalAmount} cents (${rechargeAmount} USD).`);

    if (isNaN(rechargeAmount)) {
      console.log(`Invalid chargeAmount for user ${packageRenewUserCardInfoData.userId}: ${rechargeAmount}`);
      return false;
    }

    const existsUser = await this.prisma.user.findFirst({
      where: {
        id: packageRenewUserCardInfoData.userId
      }
    })

    if (!existsUser) {
      throw new Error('User not found.');
    }

    try {

      const paymentMethods = await stripe.paymentMethods.list({
        customer: packageRenewUserCardInfoData.customerId,
        type: "card",
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: rechargeAmount,
        currency: "usd",
        customer: packageRenewUserCardInfoData.customerId,
        payment_method: paymentMethods.data[0]?.id,
        off_session: true,
        confirm: true,
        metadata: {
          user_id: packageRenewUserCardInfoData.userId?.toString() || '',
          team_id: packageRenewUserCardInfoData.teamId?.toString() || '',
          pakage_renew: "true",
        },
        description: `Package renew charge of $${amount}`,
      });

      console.log('paymentIntent', paymentIntent);

      const userTransactionDataForIn = await this.prisma.billingTransaction.create({
        data: {
          userId: Number(packageRenewUserCardInfoData.userId),
          agencyId: existsUser.agencyId,
          createdBy: existsUser.id,
          creditAmount: amount,
          billingPackageId: packageRenewUserCardInfoData.packageId,
          type: TransactionType.IN,
          transactionFor: "PackageRenew",
        },
      });

      console.log('userTransactionDataForIn', userTransactionDataForIn);

      const userTransactionDataForOut = await this.prisma.billingTransaction.create({
        data: {
          userId: Number(packageRenewUserCardInfoData.userId),
          createdBy: existsUser.id,
          agencyId: existsUser.agencyId,
          creditAmount: amount,
          billingPackageId: packageRenewUserCardInfoData.packageId,
          type: TransactionType.OUT,
          transactionFor: "PackagePurchase",
        },
      });

      console.log('userTransactionDataForOut', userTransactionDataForOut);

      const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
        data: {
          userId: Number(packageRenewUserCardInfoData.userId),
          agencyId: existsUser.agencyId,
          cardInfoId: packageRenewUserCardInfoData.cardInfoId,
          packageId: packageRenewUserCardInfoData.packageId,
          status: UserPackageRenewHistoryStatus.SUCCESS,
          chargeAmount: amount
        },
      });

      console.log('userPackageRenewHistoryData', userPackageRenewHistoryData);

      const updateNextBillingDate = await this.updateNextBillingDate(userPackage, billingPackageData);

      console.log('updateNextBillingDate : ', updateNextBillingDate);

      // const mailSendSuccess = await this.sendPackageRenewSuccessMail(amount, userData);

      // console.log('mailSendSuccess : ', mailSendSuccess);

      return true;

    } catch (error) {
      console.error("Package renew payment failed:", error);
      const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
        data: {
          userId: Number(packageRenewUserCardInfoData.userId),
          agencyId: existsUser.agencyId,
          cardInfoId: packageRenewUserCardInfoData.cardInfoId,
          packageId: packageRenewUserCardInfoData.packageId,
          status: UserPackageRenewHistoryStatus.FAILED,
          chargeAmount: amount,
          failReason: error.message ?? "Unknown failure during auto-recharge",
        },
      });
      console.log(`userPackageRenewHistoryData`, userPackageRenewHistoryData);
      // Optionally: log or send Slack alert to your team
      console.log(`Package renew failed for user ${packageRenewUserCardInfoData.userId}: ${error.message}`);
      return false;
    }
  }

  async chargeFromCurrentCreditForce(userData: User, packageRenewUserCardInfoData: PackageRenewUserCardInfo, amount: number, userPackage: UserPackage, billingPackageData: BillingPackage): Promise<boolean> {

    const existsUser = await this.prisma.user.findFirst({
      where: {
        id: packageRenewUserCardInfoData.userId
      }
    })

    if (!existsUser) {
      throw new Error('User not found.');
    }

    await this.prisma.user.update({
      where: {
        id: packageRenewUserCardInfoData.userId
      },
      data: {
        currentCredit: {
          decrement: amount
        }
      }
    });

    const userTransactionData = await this.prisma.billingTransaction.create({
      data: {
        userId: Number(packageRenewUserCardInfoData.userId),
        agencyId: existsUser.agencyId,
        createdBy: existsUser.id,
        creditAmount: amount,
        billingPackageId: packageRenewUserCardInfoData.packageId,
        type: TransactionType.OUT,
        transactionFor: "PackagePurchase",
      },
    });

    console.log('userTransactionData', userTransactionData);

    const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
      data: {
        userId: Number(packageRenewUserCardInfoData.userId),
        agencyId: existsUser.agencyId,
        cardInfoId: packageRenewUserCardInfoData.cardInfoId,
        packageId: packageRenewUserCardInfoData.packageId,
        status: UserPackageRenewHistoryStatus.SUCCESS,
        chargeAmount: amount
      },
    });

    console.log('userPackageRenewHistoryData', userPackageRenewHistoryData);

    const updateNextBillingDate = await this.updateNextBillingDate(userPackage, billingPackageData);

    console.log('updateNextBillingDate : ', updateNextBillingDate);

    // const mailSendSuccess = await this.sendPackageRenewSuccessMail(amount, userData);

    // console.log('mailSendSuccess : ', mailSendSuccess);

    return true;
  }

  private async updateNextBillingDate(userPackage: UserPackage, billingPackageData: BillingPackage): Promise<boolean> {
    const nextBillingDate = new Date();
    const cyclePeriod = billingPackageData.cyclePeriod as CyclePeriod;

    if (cyclePeriod === CyclePeriod.MONTH) {
      nextBillingDate.setDate(nextBillingDate.getDate() + 29);
    } else if (cyclePeriod === CyclePeriod.YEAR) {
      nextBillingDate.setDate(nextBillingDate.getDate() + 364);
    } else if (cyclePeriod === CyclePeriod.LIFE_TIME) {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 100);
    }

    await this.prisma.userPackage.update({
      where: { id: userPackage.id },
      data: {
        nextBillingDate: nextBillingDate,
        status: UserPackageStatus.ACTIVE,
        trialMode: AutoRechargeStatus.NO,
        updatedAt: new Date(),
      },
    });

    this.logger.info(`Next billing date updated for package ${userPackage.id} to ${nextBillingDate}`);

    return true;
  }

  async sendPackageRenewSuccessMail(amount: number, user: User): Promise<boolean> {

    console.log('user', user);

    if (user?.email) {

      const fullName = `${user.userName}`.trim();
      const subject = `Activation From Trial Successful - $${amount} charged`;
      const body = `
            <p>Dear ${fullName || "User"},</p>
            <p>We are excited to let you know that your account has been successfully <strong>activated from trial to an active subscription</strong>.</p>
            <p>A payment of <strong>$${amount.toFixed(2)}</strong> has been processed to continue providing uninterrupted access to your account features and services.</p>
            <p>Thank you for choosing us and being part of our community. If you have any questions or need assistance, feel free to reach out to our support team at any time.</p>
              <br/>
            <p>Best regards,</p>
            <p>VoiceTotal Notification System</p>
        `;

      const sendTeamInviteEmailData = await this.emailService.sendEmail({
        to: user.email,
        subject,
        body,
        user_id: BigInt(user.id)
      });

      console.log('sendTeamInviteEmailData', sendTeamInviteEmailData);

      return true;

    }

    return false;

  }

  /**
   * 
   * @param cacheTriggerEventActionQueue 
   * @returns 
   */
  async findBasicUserById(userId: bigint): Promise<BasicUser | null> {   
    try{
      const user: BasicUser = await this.prisma.user.findFirst({
          where: {
            id: userId
          },
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            status: true
          }
      });
      return user ? user : null
    }catch(err){
      this.logger.error('Error fetching basic user by id', { userId: userId, error: err });
    }
    return null;
  }

}
