import { AutoRechargeStatus, TransactionType, UserAutoRechargeStatus } from "@prisma/client";
import Stripe from "stripe";
import { StripeGateway } from "./Stripe.payment";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { EmailService } from "../email/email.service";
import { getAgency } from "@/common/helpers/default-agency-role-id.helper";
import { DEFAULT_AGENCY_NAME } from "@/utils/global-constant";

@Injectable()
export class AutoRechargeService {
  private readonly apiUrl: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(AutoRechargeService.name)
    private readonly logger: PinoLogger
  ) {
    this.apiUrl = this.configService.get<string>("BULKVS_API_URL");
  }

  // private stripeGateway = new StripeGateway(this.prisma);

  async checkAndDisableAutoRechargeOnConsecutiveFailures(userId: number): Promise<boolean> {

    let shouldSkip = false;

    const histories = await this.prisma.userAutoRechargeHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
      take: 10
    });

    let consecutiveFailures = 0;
    for (const history of histories) {
      if (history.status === UserAutoRechargeStatus.FAILED) {
        consecutiveFailures++;
      } else {
        break; // stop counting on SUCCESS or PENDING
      }
    }

    if (consecutiveFailures >= 3) {

      await this.prisma.user.update({
        where: { id: userId },
        data: { autoRecharge: AutoRechargeStatus.NO }
      });

      shouldSkip = true; //  disabled during this call

      // Fetch user info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          userName: true,
        }
      });
      const fullName = `${user.userName} || ""}`.trim();

      const body = `
            <p>Dear ${fullName || "User"},</p>
            <p>We noticed that your auto-recharge attempts have failed 3 or more times consecutively.</p>
            <p>Auto-recharge has been disabled for your safety.</p>
            <p>If you have any questions, please contact support.</p>
            <br/>
            <p>Best regards,</p>
            <p>${process.env.COMPANY_NAME}</p> 
        `;

      // if (user?.email) {
      //   await this.emailService.sendEmail({
      //     to: user.email,
      //     subject: 'Auto Recharge Disabled Due to Failures',
      //     body: body,
      //     user_id: BigInt(userId)
      //   });
      // }

    }

    return shouldSkip;
  }


  async handleAutoRecharges() {

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    type AutoRechargeUserCardInfo = {
      userId: number | null;
      packageId: number | null;
      customerId: string | null;
      autoRechargeAmount: number;
      minimumCreditThreshold: number;
      cardInfoId: number;
    };

    const autoRechargeUsers: AutoRechargeUserCardInfo[] =
      await this.prisma.$queryRaw<AutoRechargeUserCardInfo[]>`
      SELECT 
        uci.customer_id AS customerId,
        u.id AS userId,
        u.auto_recharge_amount AS autoRechargeAmount,
        u.minimum_credit_threshhold AS minimumCreditThreshold,
        uci.id AS cardInfoId,
        up.package_id AS packageId
      FROM users u
      INNER JOIN user_card_infos uci ON u.id = uci.user_id 
      INNER JOIN user_packages up ON u.id = up.user_id
      WHERE 
        u.autoRecharge = 'YES' 
        AND u.status = 'ACTIVE' 
        AND u.current_credit <= u.minimum_credit_threshhold 
        AND u.parent_user_id IS NULL 
        AND u.auto_recharge_amount > 0 
        AND uci.status = 'ACTIVE' 
        AND up.status = 'ACTIVE'
    `;

    console.log("autoRechargeUsers", autoRechargeUsers);

    for (const user of autoRechargeUsers) {

      console.log("user", user);

      if (!user.customerId) continue;

      const shouldSkip = await this.checkAndDisableAutoRechargeOnConsecutiveFailures(user.userId);

      console.log("shouldSkip", shouldSkip);

      if (shouldSkip) {
        continue;
      }

      const amount = user.autoRechargeAmount || 25;
      const feePercent = 0.029;
      const feeFixed = 0.3;
      const totalAmount = amount + amount * feePercent + feeFixed;
      const rechargeAmount = Math.round(totalAmount * 100);

      try {

        const paymentMethods = await stripe.paymentMethods.list({
          customer: user.customerId,
          type: "card",
        });

        const paymentIntent = await stripe.paymentIntents.create({
          amount: rechargeAmount,
          currency: "usd",
          customer: user.customerId,
          payment_method: paymentMethods.data[0]?.id,
          off_session: true,
          confirm: true,
          metadata: {
            user_id: user.userId?.toString() || '',
            auto_recharge: "true",
          },
          description: `Auto-recharge of $${amount}`,
        });

        console.log('paymentIntent', paymentIntent);

        const updateResponse = await this.prisma.user.update({
          where: { id: user.userId },
          data: {
            currentCredit: {
              increment: amount,
            },
          },
        });

        console.log('updateResponse', updateResponse);
        const agency = await getAgency(DEFAULT_AGENCY_NAME);

        const userTransactionData = await this.prisma.billingTransaction.create({
          data: {
            userId: Number(user.userId),
            agencyId: agency.id,
            creditAmount: amount,
            billingPackageId: user.packageId,
            type: TransactionType.IN,
            transactionFor: "AutoRecharge",
          },
        })

        console.log('userTransactionData', userTransactionData);

        const userAutoRechargeHistoryData = await this.prisma.userAutoRechargeHistory.create({
          data: {
            userId: Number(user.userId),
            cardInfoId: user.cardInfoId,
            packageId: user.packageId,
            status: UserAutoRechargeStatus.SUCCESS,
          },
        })

        console.log('userAutoRechargeHistoryData', userAutoRechargeHistoryData);

        const userRecord = await this.prisma.user.findUnique({
          where: { id: user.userId },
          select: { email: true, userName: true },
        });

        console.log('userRecord', userRecord);

        if (userRecord?.email) {

          const fullName = `${userRecord.userName} || ""}`.trim();
          const subject = `Auto Recharge Successful - $${amount} charged`;
          const body = `
            <p>Dear ${fullName || "User"},</p>
            <p>We have successfully processed your auto recharge of <strong>$${amount.toFixed(2)}</strong>.</p>
            <p>This amount has been added to your account balance.</p>
            <p>If you have any questions, please contact support.</p>
              <br/>
            <p>Best regards,</p>
            <p>${process.env.COMPANY_NAME}</p>
        `;

          // const sendEmailData = await this.emailService.sendEmail({
          //   to: userRecord.email,
          //   subject,
          //   body,
          //   user_id: BigInt(user.userId),
          // });

          // console.log('sendEmailData', sendEmailData);

        }

      } catch (error) {
        console.error("Auto-recharge payment failed:", error);
        const userAutoRechargeHistoryData = await this.prisma.userAutoRechargeHistory.create({
          data: {
            userId: Number(user.userId),
            cardInfoId: user.cardInfoId,
            packageId: user.packageId,
            status: UserAutoRechargeStatus.FAILED,
            failReason: error.message ?? "Unknown failure during auto-recharge",
          },
        });
        console.log(`userAutoRechargeHistoryData`, userAutoRechargeHistoryData);
        // Optionally: log or send Slack alert to your team
        console.log(`Auto-recharge failed for user ${user.userId}: ${error.message}`);
      }

      let isAutorecharegeOFF = await this.checkAndDisableAutoRechargeOnConsecutiveFailures(user.userId);

      console.log("isAutorecharegeOFF", isAutorecharegeOFF);

    }

  }
}