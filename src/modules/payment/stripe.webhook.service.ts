import { BadRequestException, HttpException, Injectable, Req } from "@nestjs/common";
import Stripe from "stripe";
import { InitializePaymentDto } from "./dto/initialize-payment.dto";
import { StripePaymentConfigDto } from "./dto/strip-payment-config.dto";
import { PrismaService } from "nestjs-prisma";
import { TransactionType, UserPackageStatus, WebhookStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { console } from "inspector";
import { CheckoutSessionCompleteService } from "./checkoutsessioncomplete.service";
import { GA4Service } from "../common/ga4.service";
import { EmailService } from "../email/email.service";
import { getAgency } from "@/common/helpers/default-agency-role-id.helper";
import { DEFAULT_AGENCY_NAME } from "@/utils/global-constant";


@Injectable()
export class StripeWebhookService {

  constructor(private readonly prisma: PrismaService,
    private readonly checkoutSessionCompleteService: CheckoutSessionCompleteService,
    private readonly ga4Service: GA4Service,
    private readonly emailService: EmailService
  ) { }

  /**
 * Main handler for Stripe webhook events. Validates the webhook signature, logs the event to the database,
 * and dispatches the event to the appropriate handler based on event type.
 */
  async handleStripeWebhook(@Req() req: Request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16"
    });
    console.log('Webhook received, starting processing at ' + new Date().toISOString());

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = (req as any).rawBody || req.body;
    console.log('sig ', sig);
    console.log('webhookSecret ', webhookSecret);

    if (!sig) {
      console.error('Stripe-Signature header missing');
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      if (!rawBody) {
        console.error('No webhook payload provided');
        throw new Error('No webhook payload was provided.');
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      console.log(`Processing Stripe event: ${event.type}`);
    } catch (err) {
      console.error(`⚠️ Invalid Stripe webhook signature: ${err.message}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    try {

      // Log webhook event to StripeWebhookEvents table with QUEUE status
      const webhookEvent = await this.prisma.stripeWebhookEvents.create({
        data: {
          json: {
            headers: Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value ?? ''])),
            body: rawBody,
          },
          status: WebhookStatus.QUEUE,
          stripeSignature: sig,
          stripeEventType: event.type,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('webhookEvent', webhookEvent.id);
      //checkout.session.expired
      //payment_intent.payment_failed
      //setup_intent.succeeded
      //setup_intent.succeeded
      //setup_intent.setup_failed

      const dataObject = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session | Stripe.SetupIntent;

      let metadata: Stripe.Metadata = null;

      if ('metadata' in dataObject && dataObject.metadata) {
        metadata = dataObject.metadata;
      }

      console.log('metadata', metadata);
      let chargeAmount: number = null;
      let planId: number = null;
      let planName: string = null;
      if (metadata.user_id) {



      }

      switch (event.type) {

        //Signup Checkout
        case 'checkout.session.completed':
          await this.checkoutSessionCompleteService.handleCheckoutSessionCompletedEvent(event, stripe);
          const expiredDataObject = event.data.object as Stripe.Checkout.Session;
          await this.handleCheckoutSessionCompleted(expiredDataObject);
          break;
        case 'checkout.session.expired':
          if (metadata && metadata.client_id) {
            const expiredDataObject = event.data.object as Stripe.Checkout.Session;
            await this.handleAbandonCheckout(expiredDataObject, metadata.client_id);
          }
          break;
        case 'payment_intent.payment_failed':
          if (metadata && metadata.client_id) {
            const expiredDataObject = event.data.object as Stripe.PaymentIntent;
            await this.handlePaymentFailed(expiredDataObject, metadata.client_id);
          }
          break;

        case 'setup_intent.succeeded':
          if (metadata && metadata.client_id) {
            const expiredDataObject = event.data.object as Stripe.SetupIntent;
            await this.handlePaymentMethodSaved(expiredDataObject, metadata.client_id);
          }
          break;

        case 'setup_intent.setup_failed':
          if (metadata && metadata.client_id) {
            const expiredDataObject = event.data.object as Stripe.SetupIntent;
            await this.handlePaymentMethodFailed(expiredDataObject, metadata.client_id);
          }
          break;
        //Signup Checkout
        case 'invoice.paid':
          await this.handleInvoicePaid(event, stripe);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);

      }

      return { received: true };

    } catch (error) {
      console.error(`Webhook processing error for event ${event.type}: ${error.message}, stack: ${error.stack}`);
      throw new BadRequestException('Webhook processing failed');
    }
  }

  private async handleAbandonCheckout(data: Stripe.Checkout.Session, clientId: string) {
    try {
      const ga4ServiceResponse = await this.ga4Service.sendEvent({
        client_id: clientId,
        events: [
          {
            name: 'abandon_checkout',
            params: {
              currency: data.currency,
              value: data.amount_total ? data.amount_total / 100 : undefined,
            }
          }
        ]
      });
      console.log('ga4ServiceResponse', ga4ServiceResponse);
    } catch (error) {
      // handle the error
      console.error('Something went wrong:', error);
    }
  }

  private async handlePaymentFailed(data: Stripe.PaymentIntent, clientId: string) {
    try {
      const ga4ServiceResponse = await this.ga4Service.sendEvent({
        client_id: clientId,
        events: [
          {
            name: 'payment_failure',
            params: {
              currency: data.currency,
              value: data.amount ? data.amount / 100 : undefined,
            }
          }
        ]
      });
      console.log('ga4ServiceResponse', ga4ServiceResponse);
    } catch (error) {
      // handle the error
      console.error('Something went wrong:', error);
    }
  }

  private async handlePaymentMethodSaved(data: Stripe.SetupIntent, clientId: string) {
    try {
      const ga4ServiceResponse = await this.ga4Service.sendEvent({
        client_id: clientId,
        events: [
          {
            name: 'payment_method_saved',
            params: {
              method: data.payment_method_types?.[0]
            }
          }
        ]
      });
      console.log('ga4ServiceResponse', ga4ServiceResponse);
    } catch (error) {
      // handle the error
      console.error('Something went wrong:', error);
    }
  }

  private async handlePaymentMethodFailed(data: Stripe.SetupIntent, clientId: string) {
    try {
      const ga4ServiceResponse = await this.ga4Service.sendEvent({
        client_id: clientId,
        events: [
          {
            name: 'payment_method_failed',
            params: {
              error: data.last_setup_error?.message || 'unknown'
            }
          }
        ]
      });
      console.log('ga4ServiceResponse', ga4ServiceResponse);
    } catch (error) {
      // handle the error
      console.error('Something went wrong:', error);
    }
  }

  private async handleCheckoutSessionCompleted(data: Stripe.Checkout.Session) {
    try {
      const clientId = data.metadata?.client_id;
      const planId = data.metadata?.plan_id;
      const planName = data.metadata?.plan_name;
      const amount = data.amount_total ? data.amount_total / 100 : undefined;
      const currency = data.currency;

      if (!clientId) return;

      const ga4ServiceResponse = await this.ga4Service.sendEvent({
        client_id: clientId,
        events: [
          {
            name: 'purchase',
            params: {
              transaction_id: data.id,
              value: amount,
              currency: currency,
              items: [
                {
                  item_id: planId,
                  item_name: planName || planId,
                  quantity: 1,
                  price: amount
                }
              ]
            }
          }
        ]
      });
      console.log('ga4ServiceResponse', ga4ServiceResponse);
    } catch (error) {
      // handle the error
      console.error('Something went wrong:', error);
    }

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

  private notifyUI(userId: bigint, data: { event: string; userId: bigint; creditAmount: number; packageId: bigint | null }) {
    console.log("UI Notification:", data);
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


}