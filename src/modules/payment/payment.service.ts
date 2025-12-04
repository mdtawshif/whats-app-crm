import {
  Injectable,
  HttpException,
  Req,
  BadRequestException,
  NotFoundException
} from "@nestjs/common";
import { Stripe } from "stripe";
import { InitializePaymentDto } from "./dto/initialize-payment.dto";
import { TransactionType, BillingPackage, UserPackageStatus, RequestType, RequestStatus, UserStatus, UserCardInfoStatus } from '@prisma/client';
import { Request } from "express";
import { StripeGateway } from "./Stripe.payment";
import { PrismaService } from "nestjs-prisma";
import { ManualTopUpDto } from "./dto/create-manual-top-up.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { EmailService } from "../email/email.service";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { console } from "inspector";
import { StripeWebhookService } from "./stripe.webhook.service";
import { GA4Service } from "../common/ga4.service";
import { get } from "http";
import { DEFAULT_AGENCY_NAME } from "@/utils/global-constant";
import { getAgency } from "@/common/helpers/default-agency-role-id.helper";
import { LoginUser } from "../auth/dto/login-user.dto";
import { RoleDTO } from "@/utils/RoleDTO";
import { userSelect } from "@/utils/prisma/selects/custom.select";

interface SendReminderEmailInput {
  user: any;
  userId: bigint;
  teamId: bigint | null;
  packageId: bigint | null;
  currentCreditAmount: Decimal;
  nextBillingDate: Date;
}

@Injectable()
export class PaymentService {

  private readonly apiUrl: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly ga4Service: GA4Service,
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly stripeGateway: StripeGateway,
    @InjectPinoLogger(PaymentService.name)
    private readonly logger: PinoLogger
  ) {
    this.apiUrl = this.configService.get<string>("BULKVS_API_URL");
  }

  async initializeStripePayment(dto: InitializePaymentDto) {
    const config = {
      stripe_secret_key: process.env.STRIPE_SECRET_KEY
    };

    console.log('PaymentService dto:', dto);

    let sessionURL: { url: string };

    if (dto.plan_id && !isNaN(Number(dto.plan_id))) {
      const billingPackageData = await this.prisma.billingPackage.findFirst({
        where: {
          id: Number(dto.plan_id),
        },
        select: {
          name: true
        }
      });
      dto.plan_name = billingPackageData.name;
    }

    console.log('PaymentService dto:', dto);

    if (dto.isTrial) {
      sessionURL = await this.stripeGateway.initiateSubscriptionWithTrial(dto, config);
    } else {
      sessionURL = await this.stripeGateway.initiateOneTimePayment(dto, config);
    }



    console.log('sessionURL', sessionURL);

    return sessionURL;

  }

  /**
  * Main handler for Stripe webhook events. Validates the webhook signature, logs the event to the database,
  * and dispatches the event to the appropriate handler based on event type.
  */
  async handleStripeWebhook(@Req() req: Request) {
    return await this.stripeWebhookService.handleStripeWebhook(req);
  }

  private async handleInvoicePaid(event: Stripe.Event, stripe: Stripe) {
    console.log('Processing invoice.paid event');
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string | null;
    const customerId = invoice.customer as string;

    const agency = await getAgency(DEFAULT_AGENCY_NAME);


    if (!subscriptionId) {
      // Handle one-time payment
      const paymentIntentId = invoice.payment_intent as string;
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const metadata = paymentIntent.metadata;

      if (!metadata?.user_id || !metadata?.plan_id || !metadata?.tran_id) {
        console.warn('Missing metadata in PaymentIntent:', {
          user_id: metadata?.user_id,
          plan_id: metadata?.plan_id,
          tran_id: metadata?.tran_id,
        });
        return;
      }

      const userId = BigInt(metadata.user_id);
      const teamId = metadata.team_id ? BigInt(metadata.team_id) : null;
      const packageId = BigInt(metadata.plan_id);
      const now = new Date();

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error(`User ${userId} not found`);
        return;
      }

      const cardInfo = await this.prisma.userCardInfo.findFirst({
        where: { userId, customerId },
      });

      if (!cardInfo) {
        console.error(`No card info found for user ${userId} and customer ${customerId}`);
        return;
      }

      const creditAmount = invoice.amount_paid / 100;
      const farFutureDate = new Date('2025-06-01');
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 100);


      let userPackage;
      const existingPackage = await this.prisma.userPackage.findFirst({
        where: { userId, packageId, status: 'ACTIVE' },
      });
      if (existingPackage) {
        userPackage = await this.prisma.userPackage.update({
          where: { id: existingPackage.id },
          data: { nextBillingDate: farFutureDate, updatedAt: now },
        });
      } else {

        userPackage = await this.prisma.userPackage.create({
          data: {
            userId,
            agencyId: agency.id,
            packageId,
            status: 'ACTIVE',
            startDate: now,
            nextBillingDate: farFutureDate,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      // const userPackageHistoryData = await this.prisma.userPackagesHistory.create({
      //   data: {
      //     userId,
      //     teamId,
      //     packageId,
      //     userPackageId: userPackage.id,
      //     status: 'ACTIVE',
      //     startDate: now,
      //     nextBillingDate: farFutureDate,
      //   },
      // });


      const userTransactionData = await this.prisma.billingTransaction.create({
        data: {
          userId,
          agencyId: agency.id,
          creditAmount: creditAmount,
          billingPackageId: packageId,
          type: TransactionType.IN,
          transactionFor: 'PackagePurchase',
          createdAt: now,
          updatedAt: now,
        },
      });

      const userData = await this.prisma.user.update({
        where: { id: userId },
        data: {
          updatedAt: now,
        },
      })

      // console.log("userPackageHistoryData========", userPackageHistoryData);
      console.log("userTransactionData========", userTransactionData);
      console.log("userData========", userData);

      if (paymentIntent.status === 'succeeded') {
        await this.sendPackagePurchaseEmail(user, userId, teamId, packageId, creditAmount);
      }

      this.notifyUI(userId, { event: 'payment_completed', userId, creditAmount, packageId });
      console.log(` One-time payment invoice processed for user: ${userId}`);
    } else {
      // Handle subscription payment
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const metadata = subscription.metadata;
      const isTrial = metadata.isTrial === 'true';

      if (isTrial && invoice.amount_paid === 0) {
        console.log(`Skipping invoice.paid for trial invoice: ${invoice.id}`);
        return;
      }

      if (!metadata?.user_id || !metadata?.plan_id) {
        console.warn('Missing metadata in subscription:', {
          user_id: metadata?.user_id,
          plan_id: metadata?.plan_id,
        });
        return;
      }

      const userId = BigInt(metadata.user_id);
      const teamId = metadata.team_id ? BigInt(metadata.team_id) : null;
      const packageId = BigInt(metadata.plan_id);
      const now = new Date();

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error(`User ${userId} not found`);
        return;
      }

      const cardInfo = await this.prisma.userCardInfo.findFirst({
        where: { userId, customerId },
      });
      if (!cardInfo) {
        console.error(`No card info found for user ${userId} and customer ${customerId}`);
        return;
      }

      const creditAmount = invoice.amount_paid / 100;
      const billingCycle = parseInt(metadata.billing_cycle);
      console.log("billingCycle", metadata.billing_cycle);
      console.log("metadata", metadata);
      const cycleMonths = billingCycle === 12 ? 12 : 1;
      const nextBillingDate = new Date(new Date().setMonth(now.getMonth() + cycleMonths));
      console.log("nextBillingDate", nextBillingDate);

      let userPackage;
      const existingPackage = await this.prisma.userPackage.findFirst({
        where: { userId, packageId, status: { in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING] } },
      });
      if (existingPackage) {
        userPackage = await this.prisma.userPackage.update({
          where: { id: existingPackage.id },
          data: { nextBillingDate, status: 'ACTIVE', updatedAt: now },
        });
      } else {
        userPackage = await this.prisma.userPackage.create({
          data: {
            userId,
            agencyId: agency.id,
            packageId,
            status: 'ACTIVE',
            startDate: now,
            nextBillingDate,
            providerSubscriptionId: subscriptionId,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      // const userPackageHistory = await this.prisma.userPackagesHistory.create({
      //   data: {
      //     userId,
      //     teamId,
      //     packageId,
      //     userPackageId: userPackage.id,
      //     status: 'ACTIVE',
      //     startDate: now,
      //     nextBillingDate,
      //   },
      // });

      const userTransaction = await this.prisma.billingTransaction.create({
        data: {
          userId,
          agencyId: agency.id,
          creditAmount: creditAmount,
          billingPackageId: packageId,
          type: TransactionType.IN,
          transactionFor: 'PackagePurchase',
          createdAt: now,
          updatedAt: now,
        },
      })

      const userData = await this.prisma.user.update({
        where: { id: userId },
        data: {
          updatedAt: now,
        },
      })

      // console.log("userPackageHistory============", userPackageHistory);
      console.log("userTransaction============", userTransaction);
      console.log("userData============", userData);

      const isFirstPayment = subscription.created === subscription.current_period_start;
      if (isFirstPayment) {
        await this.sendPackagePurchaseEmail(user, userId, teamId, packageId, creditAmount);
      } else {
        await this.sendRecurringPaymentEmail(user, userId, teamId, packageId, creditAmount, nextBillingDate);
      }

      this.notifyUI(userId, { event: 'recurring_payment', userId, creditAmount, packageId });
      console.log(` Subscription invoice processed for user: ${userId}`);
    }
  }

  /**
   * Handles the 'customer.subscription.updated' event. Manages subscription status changes,
   * particularly for trial endings or payment failures, updates user package status,
   * and sends notifications for payment failures or subscription activations.
   */
  private async handleSubscriptionUpdated(event: Stripe.Event, stripe: Stripe) {
    console.log('Processing customer.subscription.updated event');
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;
    const customerId = subscription.customer as string;
    const metadata = subscription.metadata;
    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    if (!metadata?.user_id || !metadata?.plan_id) {
      console.warn('Missing metadata:', {
        user_id: metadata?.user_id,
        plan_id: metadata?.plan_id,
      });
      return;
    }

    const userId = BigInt(metadata.user_id);
    const packageId = BigInt(metadata.plan_id);
    const teamId = metadata.team_id ? BigInt(metadata.team_id) : null;
    const isTrial = metadata.isTrial === 'true';
    const now = new Date();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error(`User ${userId} not found`);
      return;
    }

    const userPackage = await this.prisma.userPackage.findFirst({
      where: { userId, packageId, providerSubscriptionId: subscriptionId },
    });
    if (!userPackage) {
      console.error(`No userPackage found for user ${userId} and subscription ${subscriptionId}`);
      return;
    }

    if (isTrial && subscription.status !== 'trialing') {
      const transactions = await this.prisma.billingTransaction.findMany({
        where: { userId, billingPackageId: packageId },
      });

      let updateData: any = {
        status: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
        trialMode: 'NO',
        updatedAt: now,
      };

      if (subscription.status === 'past_due') {
        const paymentIntentId = subscription.latest_invoice
          ? (await stripe.invoices.retrieve(subscription.latest_invoice as string)).payment_intent
          : null;
        let failureMessage = 'Unknown error';
        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId as string);
          failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
        }

        updateData = {
          ...updateData,
          status: 'INACTIVE',
          message: failureMessage,
        };

        await this.prisma.user.update({
          where: { id: userId },
          data: { status: 'INACTIVE', updatedAt: now },
        });

        await this.sendPaymentFailureEmail(user, userId, teamId, packageId, failureMessage);
        this.notifyUI(userId, { event: 'payment_failed', userId, packageId, message: failureMessage });
      } else if (subscription.status === 'active' && transactions.length === 1) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { currentCredit: 0.00, updatedAt: now },
        });

        await this.sendSubscriptionActivationEmail(user, userId, teamId, packageId, subscription.current_period_end);
        this.notifyUI(userId, { event: 'subscription_activated', userId, packageId, creditAmount: 0 });
      }

      await this.prisma.userPackage.update({
        where: { id: userPackage.id },
        data: updateData,
      });

      const userPackageHistory = await this.prisma.userPackagesHistory.create({
        data: {
          userId,
          agencyId: agency.id,
          packageId,
          userPackageId: userPackage.id,
          status: updateData.status,
          startDate: userPackage.startDate,
          nextBillingDate: userPackage.nextBillingDate,
        },
      });

      console.log("userPackageHistory======", userPackageHistory);
    }
  }

  private async sendTrialActivationEmail(
    user: any,
    userId: bigint,
    teamId: bigint | null,
    packageId: bigint,
    creditAmount: number,
    trialEnd: Date
  ) {
    console.log(`Preparing to send trial activation email for user: ${userId}`);
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    const packageData = await this.prisma.billingPackage.findUnique({
      where: { id: packageId },
    });
    if (!packageData) {
      console.error(`Package ${packageId} not found`);
      return;
    }

    // const formattedTrialEnd = trialEnd.toLocaleDateString('en-US', {
    //   year: 'numeric',
    //   month: 'long',
    //   day: 'numeric',
    // });
    const subject = `Your ${packageData.name} Trial Has Started`;
    const body = `
      <p>Dear ${fullName || "User"},</p>
      <p>Thank you for starting your 7-day free trial with the <strong>${packageData.name}</strong> plan!</p>
      <ul>
        <li><strong>Package:</strong> ${packageData.name}</li>
        <li><strong>Trial Credits:</strong> ${creditAmount}</li>
        <li><strong>Trial End Date:</strong> ${trialEnd.toISOString().split("T")[0]}</li>
      </ul>
      <p>Your trial will end on ${trialEnd.toISOString().split("T")[0]}. Please ensure your payment method is up to date.</p>
      <p>If you have any questions, please contact support.</p>
        <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p> 
    `;

    // await this.emailService.sendEmail({
    //   to: user.email,
    //   subject,
    //   body,
    //   user_id: userId,
    //   // team_id: teamId,
    // });

    console.log(`Trial activation email sent successfully for user: ${userId}`);
  }

  private async sendSubscriptionActivationEmail(
    user: any,
    userId: bigint,
    teamId: bigint | null,
    packageId: bigint,
    nextBillingDate: Date
  ) {
    console.log(`Preparing to send subscription activation email for user: ${userId}`);
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    const packageData = await this.prisma.billingPackage.findUnique({
      where: { id: packageId },
    });
    if (!packageData) {
      console.error(`Package ${packageId} not found`);
      return;
    }

    // const billingDate = new Date(nextBillingDate * 1000);
    // const formattedBillingDate = billingDate.toLocaleDateString('en-US', {
    //   year: 'numeric',
    //   month: 'long',
    //   day: 'numeric',
    // });
    const subject = `Your ${packageData.name} Subscription will be Active soon`;
    const body = `
      <p>Dear ${fullName || "User"},</p>
      <p>Your 7-day free trial has ended, and your <strong>${packageData.name}</strong> subscription will be active after successful payment.</p>
      <ul>
        <li><strong>Package:</strong> ${packageData.name}</li>
        <li><strong>Amount :</strong> $${packageData.chargeAmount.toFixed(2)}</li>
      </ul>
      <p>If you have any questions, please contact support.</p>
        <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p> 
    `;

    // await this.emailService.sendEmail({
    //   to: user.email,
    //   subject,
    //   body,
    //   user_id: userId,
    //   // team_id: teamId,
    // });

    console.log(`Subscription activation email sent successfully for user: ${userId}`);
  }

  private async sendPaymentFailureEmail(
    user: any,
    userId: bigint,
    teamId: bigint | null,
    packageId: bigint,
    message: string
  ) {
    console.log(`Preparing to send payment failure email for user: ${userId}`);
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    const packageData = await this.prisma.billingPackage.findUnique({
      where: { id: packageId },
    });
    if (!packageData) {
      console.error(`Package ${packageId} not found`);
      return;
    }

    const subject = `Payment Failed for Your ${packageData.name} Subscription`;
    const body = `
      <p>Dear ${fullName || "User"},</p>
      <p>We were unable to process your payment for the <strong>${packageData.name}</strong> plan after your trial.</p>
      <ul>
        <li><strong>Package:</strong> ${packageData.name}</li>
        <li><strong>Payment Issue:</strong> ${message}</li>
      </ul>
      <p>Please update your payment method to reactivate your subscription.</p>
      <p>If you have any questions, please contact support.</p>
       <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p> 
    `;

    // await this.emailService.sendEmail({
    //   to: user.email,
    //   subject,
    //   body,
    //   user_id: userId,
    //   // team_id: teamId,
    // });

    console.log(`Payment failure email sent successfully for user: ${userId}`);
  }


  private async sendPackagePurchaseEmail(
    user: any,
    userId: bigint,
    teamId: bigint | null,
    packageId: bigint | null,
    creditAmount: number
  ) {
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    const subject = `Package Purchase Confirmation`;
    const body = `
      <p>Dear ${fullName || "User"},</p>
      <p>Thank you for your purchase! Here are the details of your package purchase:</p>
      <ul>
        <li><strong>Package ID:</strong> ${packageId}</li>
        <li><strong>Amount Charged:</strong> $${creditAmount.toFixed(2)}</li>
      </ul>
      <p>If you have any questions, please contact support.</p>
       <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p> 
    `;

    // await this.emailService.sendEmail({
    //   to: user.email,
    //   subject,
    //   body,
    //   user_id: userId,
    //   // team_id: teamId,
    // });
  }

  private async sendRecurringPaymentEmail(
    user: any,
    userId: bigint,
    teamId: bigint | null,
    packageId: bigint | null,
    creditAmount: number,
    nextBillingDate: Date
  ) {
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    const subject = `Recurring Payment Confirmation`;
    const body = `
      <p>Dear ${fullName || "User"},</p>
      <p>Your recurring payment for your package subscription has been successfully processed:</p>
      <ul>
        <li><strong>Package ID:</strong> ${packageId}</li>
        <li><strong>Amount Charged:</strong> $${creditAmount.toFixed(2)}</li>
        <li><strong>Next Billing Date:</strong> ${nextBillingDate.toISOString().split("T")[0]}</li>
      </ul>
      <p>If you have any questions, please contact support.</p>
        <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p> 
    `;

    // await this.emailService.sendEmail({
    //   to: user.email,
    //   subject,
    //   body,
    //   user_id: userId,
    //   // team_id: teamId,
    // });
  }


  public async sendReminderEmail(data: SendReminderEmailInput): Promise<void> {
    const { user, userId, teamId, packageId, currentCreditAmount, nextBillingDate } = data;

    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    const formattedDate = nextBillingDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `Subscription Renewal Reminder`;
    const body = `
      <p>Dear ${fullName || "User"},</p>
      <p>This is a reminder that your subscription is scheduled to renew in 2 days. Here are the details:</p>
      <ul>
        <li><strong>Package ID:</strong> ${packageId}</li>
        <li><strong>Amount to be Charged:</strong> $${currentCreditAmount.toFixed(2)}</li>
        <li><strong>Renewal Date:</strong> ${formattedDate}</li>
      </ul>
      <p>If you wish to update or cancel your subscription, please visit your account settings or contact support.</p>
      <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p> 
    `;

    // await this.emailService.sendEmail({
    //   to: user.email,
    //   subject,
    //   body,
    //   user_id: userId,
    //   // team_id: teamId,
    // });
  }

  private notifyUI(userId: bigint, data: { event: string; userId: bigint; creditAmount: number; packageId: bigint | null }) {
    console.log("UI Notification:", data);
  }


  async manualTopUp(user: LoginUser, dto: ManualTopUpDto) {
    const amount = Number(dto.amount);
    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    if (amount <= 0) {
      throw new BadRequestException("Invalid top-up amount");
    }

    const userId = typeof user.id === "string" ? BigInt(user.id) : user.id;

    const userInfo = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE" }
    });

    const activePackage = await this.prisma.userPackage.findFirst({
      where: { userId: userId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Get latest card info (if any)
    const latestCardInfo = await this.prisma.userCardInfo.findFirst({
      where: { userId: userId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: "desc" },
    });

    console.log("=========", userInfo);

    if (!userInfo) {
      throw new NotFoundException("User not found");
    }

    if (!activePackage) throw new BadRequestException("No active package found");

    console.log("Fetched userCardInfos:------------------", latestCardInfo);

    if (!latestCardInfo) {
      throw new BadRequestException("No active card found");
    }

    if (!latestCardInfo.customerId) {
      throw new BadRequestException("Stored card information incomplete: missing customer ID");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    // Verify customer exists
    try {
      const customer = await stripe.customers.retrieve(latestCardInfo.customerId);
      if (!customer || customer.deleted) {
        throw new BadRequestException("Invalid customer ID");
      }
    } catch (error) {
      console.error("Stripe customer retrieval error:", error);
      throw new BadRequestException("Invalid customer ID");
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: latestCardInfo.customerId,
      type: "card",
    });

    // if (!paymentMethods.data.length) {
    //   throw new BadRequestException("No valid payment methods found for this customer");
    // }

    const baseAmount = amount;
    const fee = baseAmount * 0.029 + 0.30;
    const totalAmount = baseAmount + fee;
    const amountInCents = Math.round(totalAmount * 100);

    console.log("cardInfo----------------->>", latestCardInfo);
    console.log("cardInfo token=================>>", latestCardInfo.token);

    try {
      // Charge the stored card off-session
      await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        customer: latestCardInfo.customerId,
        payment_method: paymentMethods.data[0].id,
        off_session: true,
        confirm: true,
        description: `Manual top-up of $${amount}`,
        metadata: {
          user_id: user.id.toString(),
          package_id: activePackage.packageId.toString(),
          amount: baseAmount.toString(),
          type: "manual_topup",
        },
      });

      // Use Prisma Decimal to increment credit
      const incrementAmount = new Decimal(amount);

      // Update credit and log transaction atomically
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: {
            currentCredit: {
              increment: incrementAmount,
            },
          },
        }),
        this.prisma.billingTransaction.create({
          data: {
            userId: user.parentUserId ? user.parentUserId : user.id,
            createdBy: user.id,
            agencyId: agency.id,
            creditAmount: parseFloat(incrementAmount.toString()),
            billingPackageId: activePackage.packageId,
            type: "IN",
            transactionFor: 'ManualTopUp', // or define ManualTopUp in your enum for clarity
          },
        }),
      ]);

      return { success: true, message: `Manual top-up of $${amount} completed.` };
    } catch (error) {
      console.error("Manual top-up payment failed:", error);
      throw new BadRequestException("Payment failed. Please try again or use a different card.");
    }
  }

  async updateDefaultPaymentMethod(user: LoginUser, paymentMethodId: string) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const cardInfo = await this.prisma.userCardInfo.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        customerId: true
      }
    })
    console.log("cardInfo======", cardInfo);

    if (!cardInfo || !cardInfo.customerId) {
      throw new Error('Card info not found');
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: cardInfo.customerId,
    });

    // Step 2: Set as default payment method
    await stripe.customers.update(cardInfo.customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Step 3: Get card details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (
      paymentMethod.object !== 'payment_method' ||
      paymentMethod.type !== 'card' ||
      !paymentMethod.card
    ) {
      throw new Error('Invalid card payment method');
    }

    const { last4, brand, exp_month, exp_year, fingerprint } = paymentMethod.card;

    // Optional: Construct masked card number
    const maskedCard = `**** **** **** ${last4}`;
    const cardBrand = brand;
    const expireYear = exp_year;
    const expireMonth = exp_month;

    // Step 4: Update in DB
    await this.prisma.userCardInfo.updateMany({
      where: {
        customerId: cardInfo.customerId,
      },
      data: {
        cardNumber: maskedCard,
        cardBrand,
        cardExpMonth: expireMonth,
        cardExpYear: expireYear,
        token: paymentMethodId,
        updatedAt: new Date(),
      },
    });

    return {
      status: 200,
      success: true,
      message: 'Payment method updated successfully',
      cardInfo: {
        brand,
        last4,
        exp_month,
        exp_year,
      },
    };
  }

  async cancelUserSubscription(userDto: LoginUser, dto: CancelSubscriptionDto) {
    const userPackageData = await this.prisma.userPackage.findFirst({
      where: {
        id: dto.userPackageId,
        // userId: userDto.id,
        status: { in: ['ACTIVE', 'TRIALING'] },
      }
    })

    console.log("userPackageData-===============", userPackageData);
    if (!userPackageData) {
      throw new NotFoundException("User package not found");
    }

    const now = new Date();

    const requestType = dto.cancelType === 'now'
      ? RequestType.CANCEL_SUBSCRIPTION
      : RequestType.CANCEL_SUBSCRIPTION;

    const executeAt = dto.cancelType === 'now' ? now : userPackageData.nextBillingDate;

    console.log("requestType============", requestType);
    // Add to UserRequest queue
    await this.prisma.userRequest.create({
      data: {
        userId: userDto.parentUserId || userDto.id,
        createdBy: userDto.id,
        agencyId: userDto.agencyId || null,
        type: requestType,
        requestAt: now,
        scheduleAt: executeAt,
        requestBody: {
          cancelType: dto.cancelType,
          userPackageId: Number(userPackageData.id),
          executeAt: executeAt,
        },
        status: RequestStatus.QUEUE,
        message: dto.message || null,
      },
    });

    await this.prisma.user.update({
      where: { id: userDto.id },
      data: {
        status: UserStatus.CANCEL_SUB_REQUESTED,
      },
    });

    return {
      status: 200,
      success: true,
      message: 'Subscription canceled requested successfully',
    };
  }

  async processCancelSubscriptions() {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const now = new Date();

    const requests = await this.prisma.userRequest.findMany({
      where: {
        status: RequestStatus.QUEUE,
        type: {
          in: [RequestType.CANCEL_SUBSCRIPTION],
        },
        scheduleAt: { lte: now },
      },
    });

    console.log("requests-===============", requests);

    for (const request of requests) {

      //  Update status to PROCESSING
      await this.prisma.userRequest.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.PROCESSING,
          message: 'Started processing cancellation',
        },
      });
      try {
        const body = request.requestBody as {
          userPackageId: string;
          cancelType: 'now' | 'end_of_cycle';
          executeAt: string;
        };
        const executeAt = new Date(body.executeAt);

        const userPackage = await this.prisma.userPackage.findUnique({
          where: { id: BigInt(body.userPackageId) },
          include: {
            user: {
              select: {
                id: true
              }
            }
          },
        });

        if (!userPackage || !userPackage.user) {
          throw new Error(`UserPackage or User not found for ID: ${body.userPackageId}`);
        }

        const userId = userPackage.user.id;

        //  Get customerId from UserCardInfo
        const cardInfo = await this.prisma.userCardInfo.findFirst({
          where: {
            userId,
            status: UserCardInfoStatus.ACTIVE,
            customerId: { not: null },
          },
          select: { customerId: true },
        });

        const stripeCustomerId = cardInfo?.customerId || null; // modify if stored elsewhere

        // 1. Cancel Stripe subscriptions and delete customer
        if (stripeCustomerId) {
          // Cancel all active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
          });

          for (const subscription of subscriptions.data) {
            if (body.cancelType === 'now') {
              await stripe.subscriptions.cancel(subscription.id);
            } else {
              await stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: true,
              });
            }
          }

          // Delete customer
          if (body.cancelType === 'now') {
            await stripe.customers.del(stripeCustomerId);
          }
        }

        // 4. Delete User
        if (body.cancelType === 'end_of_cycle') {
          await this.prisma.user.update({
            where: { id: userId },
            data: { status: UserStatus.CANCEL_SUB_REQUESTED },
          });
        } else if (body.cancelType === 'now' && executeAt <= now) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { status: UserStatus.DELETED },
          });
        }

        // 5. Mark request as processed
        await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.PROCESSED,
            message: 'Cancellation completed',
          },
        });

      } catch (error) {
        await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.FAILED,
            message: `Failed to cancel subscription: ${error.message}`,
          },
        });
      }
    }
  }

}
