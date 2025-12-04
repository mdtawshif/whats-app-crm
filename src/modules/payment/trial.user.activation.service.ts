import { BillingPackage, CyclePeriod, Prisma, TransactionType, User, UserPackage, UserPackageRenewHistoryStatus, UserPackageStatus, YesNo } from "@prisma/client";
import Stripe from "stripe";
import { StripeGateway } from "./Stripe.payment";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { EmailService } from "../email/email.service";
import { PackageRenewUserCardInfo } from "./dto/package-renew.dto";
import { getAgency, getRole } from "@/common/helpers/default-agency-role-id.helper";
import { DEFAULT_AGENCY_NAME } from "@/utils/global-constant";
import { create } from 'lodash';

@Injectable()
export class TrialUserActivationService {
  private readonly apiUrl: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(TrialUserActivationService.name)
    private readonly logger: PinoLogger
  ) {
    this.apiUrl = this.configService.get<string>("BULKVS_API_URL");
  }

  /**
   * Send success email after user activation.
   */
  async sendPackageRenewSuccessMail(amount: number, user: User): Promise<boolean> {

    console.log('user', user);

    if (user?.email) {

      const fullName = `${user.userName} || ""}`.trim();
      const subject = `Activation From Trial Successful - $${amount} charged`;
      const body = `
            <p>Dear ${fullName || "User"},</p>
            <p>We are excited to let you know that your account has been successfully <strong>activated from trial to an active subscription</strong>.</p>
            <p>A payment of <strong>$${amount.toFixed(2)}</strong> has been processed to continue providing uninterrupted access to your account features and services.</p>
            <p>Thank you for choosing us and being part of our community. If you have any questions or need assistance, feel free to reach out to our support team at any time.</p>
              <br/>
            <p>Best regards,</p>
            <p>${process.env.COMPANY_NAME}</p> 
        `;

      // const sendEmailData = await this.emailService.sendEmail({
      //   to: user.email,
      //   subject,
      //   body,
      //   user_id: BigInt(user.id),
      //   // team_id: user.teamId ? BigInt(user.teamId) : undefined,
      // });

      // console.log('sendEmailData', sendEmailData);

      return true;

    }

    return false;

  }

  /**
 * Update the next billing date of a user's package based on the billing package cycle period.
 */
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
        trialMode: YesNo.NO,
        updatedAt: new Date(),
      },
    });

    this.logger.info(`Next billing date updated for package ${userPackage.id} to ${nextBillingDate}`);

    return true;
  }

  async chargeFromCurrentCreditForce(userData: User, packageRenewUserCardInfoData: PackageRenewUserCardInfo, amount: number, userPackage: UserPackage, billingPackageData: BillingPackage): Promise<boolean> {

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

    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    const userTransactionData = await this.prisma.billingTransaction.create({
      data: {
        userId: userData.parentUserId ? userData.parentUserId : userData.id,
        agencyId: agency.id,
        createdBy : userData.id,
        creditAmount: amount,
        billingPackageId: packageRenewUserCardInfoData.packageId,
        type: TransactionType.OUT,
        transactionFor: 'PackageRenew',
      },
    });

    console.log('userTransactionData', userTransactionData);

    const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
      data: {
        userId: userData.parentUserId ? userData.parentUserId : userData.id,
        agencyId: agency.id,
        cardInfoId: packageRenewUserCardInfoData.cardInfoId,
        packageId: packageRenewUserCardInfoData.packageId,
        status: UserPackageRenewHistoryStatus.SUCCESS,
        chargeAmount: amount
      },
    });

    const updateNextBillingDate = await this.updateNextBillingDate(userPackage, billingPackageData);

    console.log('updateNextBillingDate : ', updateNextBillingDate);

    const mailSendSuccess = await this.sendPackageRenewSuccessMail(amount, userData);

    console.log('mailSendSuccess : ', mailSendSuccess);

    return true;
  }


  async chargeFromCurrentCredit(userData: User, packageRenewUserCardInfoData: PackageRenewUserCardInfo, amount: number, userPackage: UserPackage, billingPackageData: BillingPackage): Promise<boolean> {

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

    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    //Add user transaction
    const userTransactionData = await this.prisma.billingTransaction.create({
      data: {
        userId: userData.parentUserId ? userData.parentUserId : userData.id,
        createdBy : userData.id,
        agencyId: agency.id,
        creditAmount: amount,
        billingPackageId: packageRenewUserCardInfoData.packageId,
        type: TransactionType.OUT,
        transactionFor: 'PackageRenew',
      },
    });

    console.log('userTransactionData', userTransactionData);

    //Add user package renew history 
    const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
      data: {
        userId: userData.parentUserId ? userData.parentUserId : userData.id,
        agencyId: agency.id,
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
    const mailSendSuccess = await this.sendPackageRenewSuccessMail(amount, userData);

    console.log('mailSendSuccess : ', mailSendSuccess);

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

      const agency = await getAgency(DEFAULT_AGENCY_NAME);

      const userTransactionDataForIn = await this.prisma.billingTransaction.create({
        data: {
          userId: userData.parentUserId ? userData.parentUserId : userData.id,
          createdBy : userData.id,
          agencyId: agency.id,
          creditAmount: amount,
          billingPackageId: packageRenewUserCardInfoData.packageId,
          type: TransactionType.IN,
          transactionFor: 'PackageRenew',
        },
      });

      console.log('userTransactionDataForIn', userTransactionDataForIn);

      const userTransactionDataForOut = await this.prisma.billingTransaction.create({
        data: {
          userId: userData.parentUserId ? userData.parentUserId : userData.id,
          createdBy : userData.id,
          agencyId: agency.id,
          creditAmount: amount,
          billingPackageId: packageRenewUserCardInfoData.packageId,
          type: TransactionType.OUT,
          transactionFor: 'PackageRenew',
        },
      });

      console.log('userTransactionDataForOut', userTransactionDataForOut);

      const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
        data: {
          userId: userData.parentUserId ? userData.parentUserId : userData.id,
          agencyId: agency.id,
          cardInfoId: packageRenewUserCardInfoData.cardInfoId,
          packageId: packageRenewUserCardInfoData.packageId,
          status: UserPackageRenewHistoryStatus.SUCCESS,
          chargeAmount: amount
        },
      });

      console.log('userPackageRenewHistoryData', userPackageRenewHistoryData);

      const updateNextBillingDate = await this.updateNextBillingDate(userPackage, billingPackageData);

      console.log('updateNextBillingDate : ', updateNextBillingDate);

      const mailSendSuccess = await this.sendPackageRenewSuccessMail(amount, userData);

      console.log('mailSendSuccess : ', mailSendSuccess);

      return true;

    } catch (error) {
      console.error("Package renew payment failed:", error);

      const agency = await getAgency(DEFAULT_AGENCY_NAME);
      const userPackageRenewHistoryData = await this.prisma.userPackageRenewHistory.create({
        data: {
          userId: userData.parentUserId ? userData.parentUserId : userData.id,
          agencyId: agency.id,
          cardInfoId: packageRenewUserCardInfoData.cardInfoId,
          packageId: packageRenewUserCardInfoData.packageId,
          status: UserPackageRenewHistoryStatus.FAILED,
          failReason: error.message ?? "Unknown failure during auto-recharge",
          chargeAmount: amount
        },
      });
      console.log(`userPackageRenewHistoryData`, userPackageRenewHistoryData);
      // Optionally: log or send Slack alert to your team
      console.log(`Package renew failed for user ${packageRenewUserCardInfoData.userId}: ${error.message}`);
      return false;
    }

    return false;
  }

  async handleTrialUserActivationProcess() {

    console.log('handleTrialUserActivationProcess started ########################');

    const trialActivationUsers: PackageRenewUserCardInfo[] =
      await this.prisma.$queryRaw<PackageRenewUserCardInfo[]>`
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
        AND u.parent_id IS NULL 
        AND uci.status = 'ACTIVE' 
        AND up.status = 'TRIALING'
        AND up.trial_end <= NOW() 
    `;

    console.log("trialActivationUsers", trialActivationUsers);

    for (const user of trialActivationUsers) {

      console.log("user", user);

      if (!user.customerId) continue;

      if (!user.chargeAmount) {
        console.log("invalid charge amount", user.chargeAmount);
        continue;
      }

      let amount: number = 0; // explicitly tell TypeScript it will be a number

      if (user.chargeAmount instanceof Prisma.Decimal) {
        amount = user.chargeAmount.toNumber();
      } else if (typeof user.chargeAmount === "string") {
        amount = parseFloat(user.chargeAmount);
      } else if (typeof user.chargeAmount === "number") {
        amount = user.chargeAmount;
      }

      if (amount <= 0 || isNaN(amount)) {
        console.log("invalid charge amount", amount);
        continue;
      }

      const userData = await this.prisma.user.findFirst({
        where: {
          id: user.userId
        }
      });

      // let requestData: UserRequest = null;

      // requestData = await this.prisma.userRequest.findFirst({
      //   where: {
      //     userId: userData.id,
      //     type: RequestType.ChangePackagePlan,
      //     status: RequestStatus.QUEUE,
      //   }
      // });

      // console.log('requestData', requestData);

      // if (requestData) {

      //   const requestBody = requestData.requestBody as { packageId: number };
      //   console.log('requestBody', requestBody);
      //   if (requestBody?.packageId) {
      //     const updateUserPackageData = await this.prisma.userPackage.updateMany({
      //       where: {
      //         userId: userData.id,
      //       },
      //       data: {
      //         packageId: requestBody.packageId,
      //       }
      //     });
      //     console.log('updateUserPackageData', updateUserPackageData);
      //   }

      //   await this.prisma.userRequest.update({
      //     where: {
      //       id: requestData.id
      //     },
      //     data: {
      //       status: RequestStatus.PROCESSED
      //     }
      //   });

      // }

      const userPackage = await this.prisma.userPackage.findFirst({
        where: {
          userId: userData.id,
        },
      });

      console.log('userPackage', userPackage);

      const billingPackageData = await this.prisma.billingPackage.findFirst({
        where: {
          id: userPackage.packageId
        }
      });

      console.log('billingPackageData', billingPackageData);

      if (userData.currentCredit.toNumber() >= amount) {
        const userActivationFromCurrentCredit = await this.chargeFromCurrentCredit(userData, user, amount, userPackage, billingPackageData);
        console.log("userActivationFromCurrentCredit", userActivationFromCurrentCredit);
      } else {
        const packageRenewChargeFromStripeCard = await this.chargeFromStripeCard(userData, user, amount, userPackage, billingPackageData);
        console.log("packageRenewChargeFromStripeCard", packageRenewChargeFromStripeCard);
        if (!packageRenewChargeFromStripeCard) {
          const packageRenewChargeFromCurrentCredit = await this.chargeFromCurrentCreditForce(userData, user, amount, userPackage, billingPackageData);
          console.log("packageRenewChargeFromCurrentCredit", packageRenewChargeFromCurrentCredit);
        }
      }

    }

  }
}