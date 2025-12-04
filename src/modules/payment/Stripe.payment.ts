import { HttpException, Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { InitializePaymentDto } from "./dto/initialize-payment.dto";
import { StripePaymentConfigDto } from "./dto/strip-payment-config.dto";
import { PrismaService } from "nestjs-prisma";
import { TransactionType, User, UserCardInfoStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { GA4Service } from "../common/ga4.service";
import { getAgency } from "@/common/helpers/default-agency-role-id.helper";
import { DEFAULT_AGENCY_NAME } from "@/utils/global-constant";

@Injectable()
export class StripeGateway {
  constructor(private readonly prisma: PrismaService,
    private readonly ga4Service: GA4Service
  ) { }

  private async getOrCreateCustomer(params: InitializePaymentDto, stripe: Stripe): Promise<{ id: string }> {

    if (params.old_customer_id) {
      // Reuse existing customer
      console.log(` Using existing customer: ${params.old_customer_id}`);
      return { id: params.old_customer_id };
    }

    console.log('params?.registrationData', params?.registrationData);
    console.log('params?.registrationData?.firstName', params?.registrationData?.user_name);

    const userId = params.user_id;

    console.log(`userId :`, userId);
    let userData: User = null;

    if (userId) {
      userData = await this.prisma.user.findFirst({
        where: {
          id: userId
        }
      });
    }

    if (!userData) {
      console.log('Invalid User Inof');
      return { id: null };
    }

    const userCardInfo = await this.prisma.userCardInfo.findFirst({
      where: {
        userId: userId,
        status: {
          in: [UserCardInfoStatus.ACTIVE, UserCardInfoStatus.TRIALING],
        }
      }
    });

    if (userCardInfo) {

      return { id: userCardInfo.customerId };

    }

    // Create new customer
    const name = [userData.userName].filter(Boolean).join(" ") || "Unknown";
    console.log(`name :`, name);
    const customer = await stripe.customers.create({
      email: userData.email,
      name: name,
      metadata: {
        userId: params.user_id?.toString(),
        tran_id: params.tran_id || uuidv4(),
        // team_id: params.team_id?.toString(),
        plan_id: params.plan_id?.toString(),
        client_id: params.client_id?.toString(),
        isTrial: params.isTrial ? "true" : "false",
      },
    });

    console.log(` Created new Stripe customer: ${customer.id}`);
    return { id: customer.id };
  }


  private calculateTotalAmount(params: InitializePaymentDto): number {
    const feePercent = 0.029;
    const feeFixed = 0.30;
    const baseAmount = Number(params.amount_without_charge || 1);
    const serviceCharge = Number(params.service_charge || 0);
    return baseAmount + baseAmount * feePercent + feeFixed + serviceCharge;
  }

  private getServiceChargeItem(params: InitializePaymentDto) {
    if (params.service_charge && !params.isTrial) {
      return [{
        price_data: {
          currency: params.currency || "usd",
          product_data: {
            name: "Service Charge",
            description: "Service Charge",
          },
          unit_amount: Math.round(params.service_charge * 100),
        },
        quantity: 1,
      }];
    }
    return [];
  }



  async initiateSubscriptionWithTrial(params: InitializePaymentDto, config: StripePaymentConfigDto) {
    try {
      const stripe = new Stripe(config.stripe_secret_key, { apiVersion: "2023-10-16" });
      const customer = await this.getOrCreateCustomer(params, stripe);
      await this.saveCardInfo(params, customer);

      const totalAmount = this.calculateTotalAmount(params);
      const productUnitAmount = Math.round(totalAmount * 100);
      const serviceChargeItem = this.getServiceChargeItem(params);

      const session = await this.createStripeCheckoutSessionForSubscription(
        params, stripe, customer, productUnitAmount, serviceChargeItem, totalAmount, true // trial = true
      );
      console.log('params', params);
      if (session?.url && params.client_id) {
        console.log('this.ga4Service', this.ga4Service);
        const ga4ServiceResponse = await this.ga4Service.sendEvent({
          client_id: params.client_id, // should come from browser (cookie or manually captured)
          events: [
            {
              name: 'begin_checkout',
              params: {
                currency: 'USD',
                value: params.amount_without_charge,
                items: [
                  {
                    item_id: params.plan_id,
                    item_name: params.plan_name,
                    quantity: 1,
                    price: params.amount_without_charge
                  }
                ]
              }
            }
          ]
        });

        console.log('ga4ServiceResponse', ga4ServiceResponse);

      }

      return { url: session?.url };
    } catch (error) {
      console.error("Initiate subscription with trial error:", error);
      throw new HttpException({
        message: "Subscription with trial initiation failed. Please contact support.",
        responseCode: 400,
        success: false,
      }, 400);
    }
  }

  async initiateSubscription(params: InitializePaymentDto, config: StripePaymentConfigDto) {
    try {
      const stripe = new Stripe(config.stripe_secret_key, { apiVersion: "2023-10-16" });
      const customer = await this.getOrCreateCustomer(params, stripe);
      await this.saveCardInfo(params, customer);

      const totalAmount = this.calculateTotalAmount(params);
      const productUnitAmount = Math.round(totalAmount * 100);
      const serviceChargeItem = this.getServiceChargeItem(params);

      const session = await this.createStripeCheckoutSessionForSubscription(
        params, stripe, customer, productUnitAmount, serviceChargeItem, totalAmount, false // no trial
      );

      return { url: session?.url };
    } catch (error) {
      console.error("Initiate subscription error:", error);
      throw new HttpException({
        message: "Subscription initiation failed. Please contact support.",
        responseCode: 400,
        success: false,
      }, 400);
    }
  }

  async initiateOneTimePayment(params: InitializePaymentDto, config: StripePaymentConfigDto) {
    try {
      const stripe = new Stripe(config.stripe_secret_key, { apiVersion: "2023-10-16" });
      const customer = await this.getOrCreateCustomer(params, stripe);
      await this.saveCardInfo(params, customer);

      const totalAmount = this.calculateTotalAmount(params);
      const productUnitAmount = Math.round(totalAmount * 100);

      const serviceChargeItem = this.getServiceChargeItem(params);

      const session = await this.createStripeCheckoutSessionForOneTime(
        params, stripe, customer, productUnitAmount, serviceChargeItem, totalAmount
      );
      console.log('params', params);
      if (session?.url && params.client_id) {
        console.log('this.ga4Service', this.ga4Service);
        const ga4ServiceResponse = await this.ga4Service.sendEvent({
          client_id: params.client_id, // should come from browser (cookie or manually captured)
          events: [
            {
              name: 'begin_checkout',
              params: {
                currency: 'USD',
                value: params.amount_without_charge,
                items: [
                  {
                    item_id: params.plan_id,
                    item_name: params.plan_name,
                    quantity: 1,
                    price: params.amount_without_charge
                  }
                ]
              }
            }
          ]
        });

        console.log('ga4ServiceResponse', ga4ServiceResponse);

      }

      return { url: session?.url };

    } catch (error) {
      console.error("Initiate one-time payment error:", error);
      throw new HttpException({
        message: "One-time payment initiation failed. Please contact support.",
        responseCode: 400,
        success: false,
      }, 400);
    }
  }

  private async createStripeCheckoutSessionForOneTime(
    params: InitializePaymentDto,
    stripe: Stripe,
    customer: { id: string },
    productUnitAmount: number,
    serviceChargeItem: any[],
    totalAmount: number
  ): Promise<Stripe.Checkout.Session> {
    const tran_id = params.tran_id || uuidv4();

    const paymentIntentParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment", // One-time payment
      payment_method_types: ["card"],
      customer: customer.id,
      success_url: `${process.env.CLIENT_BASE_URL}/payment/success`,
      cancel_url: `${process.env.CLIENT_BASE_URL}/payment/failed`,
      metadata: {
        tran_id,
        plan_id: params.plan_id,
        // team_id: params.team_id,
        user_id: params.user_id,
        client_id: params.client_id?.toString(),
        total_amount: totalAmount.toFixed(2),
        isTrial: params.isTrial ? "true" : "false",
      },
      line_items: [
        {
          price_data: {
            currency: params.currency || "usd",
            product_data: {
              name: params.name || "Package",
              description: params.description || "Package purchase",
              images: params.image_url ? [params.image_url] : [],
              metadata: {
                id: params.plan_id,
              },
            },
            unit_amount: productUnitAmount,
          },
          quantity: 1,
        },
        ...serviceChargeItem,
      ],
      payment_intent_data: {
        setup_future_usage: "off_session", // save card for potential future billing if needed
        metadata: {
          customer_id: customer.id,
          order_id: tran_id,
          plan_id: params.plan_id,
          // team_id: params.team_id,
          user_id: params.user_id,
          client_id: params.client_id?.toString(),
          total_amount: totalAmount.toFixed(2),
          isTrial: params.isTrial ? "true" : "false",
        },
        description: "Payment for package purchase",
      },
    };

    try {
      const session = await stripe.checkout.sessions.create(paymentIntentParams);
      console.log(` Created one-time Checkout Session: ${session.id}`);
      return session;
    } catch (error) {
      console.error("Error creating Stripe one-time checkout session:", error);
      throw error;
    }
  }

  private async createStripeCheckoutSessionForSubscription(
    params: InitializePaymentDto,
    stripe: Stripe,
    customer: { id: string },
    productUnitAmount: number,
    serviceChargeItem: any[],
    totalAmount: number,
    isTrial: boolean
  ): Promise<Stripe.Checkout.Session> {

    console.log('createStripeCheckoutSessionForSubscription params', params);

    const tran_id = params.tran_id || uuidv4();

    // Create/find price for subscription
    const priceId = await this.getOrCreatePlan({
      metadata: {
        tran_id,
        plan_id: params.plan_id,
        user_id: params.user_id,
        billing_cycle: params.billing_cycle?.toString() || "1",
        isTrial: isTrial.toString(),
        client_id: params.client_id?.toString(),
      },
      productName: `${params.plan_id}-${params.title}`,
      currency: params.currency || "usd",
      amount: Math.round(productUnitAmount),
      recurring: {
        interval: "month",
        interval_count: params.billing_cycle > 0 ? params.billing_cycle : 1,
      },
      stripe,
    });

    const paymentIntentParams: Stripe.Checkout.SessionCreateParams = {
      mode: "setup",
      payment_method_types: ["card"],
      customer: customer.id,
      success_url: `${process.env.CLIENT_BASE_URL}/payment/success`,
      cancel_url: `${process.env.CLIENT_BASE_URL}/payment/failed`,
      metadata: {
        tran_id,
        plan_id: params.plan_id,
        // team_id: params.team_id,
        user_id: params.user_id,
        client_id: params.client_id?.toString(),
        billing_cycle: params.billing_cycle?.toString() || "1",
        total_amount: totalAmount.toFixed(2),
        isTrial: isTrial.toString(),
      }
    };

    try {
      const session = await stripe.checkout.sessions.create(paymentIntentParams);
      console.log(` Created subscription Checkout Session: ${session.id}`);
      return session;
    } catch (error) {
      console.error("Error creating Stripe subscription checkout session:", error);
      throw error;
    }
  }

  async cancelSubscription(config: StripePaymentConfigDto, subscriptionId: string) {
    const stripe = new Stripe(config.stripe_secret_key, {
      apiVersion: "2023-10-16",
    });

    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.log(error.message);
      throw new Error(error.message);
    }
  }

  async getOrCreatePlan({
    metadata,
    productName,
    currency,
    amount,
    recurring,
    stripe,
  }: {
    metadata: any;
    productName: string;
    currency: string;
    amount: number;
    recurring: { interval: "day" | "month" | "year"; interval_count: number };
    stripe: Stripe;
  }): Promise<string> {
    const product = await this.findOrCreateProduct({
      metadata,
      productName,
      stripe,
    });
    const price = await this.findOrCreatePrice({
      metadata,
      productId: product.id,
      currency,
      amount,
      recurring: {
        interval: "month",
        interval_count: recurring.interval_count || 1,
      },
      stripe,
    });

    return price.id;
  }

  private async findOrCreateProduct({
    metadata,
    productName,
    stripe,
  }: {
    metadata: any;
    productName: string;
    stripe: Stripe;
  }): Promise<Stripe.Product> {
    const products = await stripe.products.list({ limit: 100 });
    let product = products.data.find((p) => p.name === productName);

    if (!product) {
      product = await stripe.products.create({
        name: productName,
        metadata,
      });
    }

    return product;
  }

  private async findOrCreatePrice({
    metadata,
    productId,
    currency,
    amount,
    recurring,
    stripe,
  }: {
    metadata: any;
    productId: string;
    currency: string;
    amount: number;
    recurring: { interval: "day" | "month" | "year"; interval_count: number };
    stripe: Stripe;
  }): Promise<Stripe.Price> {
    const prices = await stripe.prices.list({
      product: productId,
      limit: 100,
    });

    let price = prices.data.find(
      (p) =>
        p.unit_amount === amount &&
        p.recurring?.interval === recurring.interval &&
        p.recurring?.interval_count === recurring.interval_count
    );

    if (!price) {
      price = await stripe.prices.create({
        metadata,
        unit_amount: amount,
        currency,
        recurring,
        product: productId,
      });
    }

    return price;
  }

  async saveCardInfo(params: InitializePaymentDto, customer: { id: string }) {
    const existingCardInfo = await this.prisma.userCardInfo.findFirst({
      where: {
        userId: params.user_id,
        //  teamId: params.team_id 
      },
    });

    const agency = await getAgency(DEFAULT_AGENCY_NAME);

    if (existingCardInfo) {
      await this.prisma.userCardInfo.update({
        where: { id: existingCardInfo.id },
        data: {
          customerId: customer.id,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.userCardInfo.create({
        data: {
          userId: params.user_id,
          // teamId: params.team_id,
          agencyId: agency.id,
          customerId: customer.id,
          status: "ACTIVE",
          cardNumber: "**** **** **** ****",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }

}