import { BillingPackage, CyclePeriod, TransactionType, User, UserPackage, UserPackageStatus, YesNo } from "@prisma/client";
import { Stripe } from "stripe";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { EmailService } from "../email/email.service";
import { get } from "http";
import { DEFAULT_AGENCY_NAME } from "@/utils/global-constant";
import { getAgency } from "@/common/helpers/default-agency-role-id.helper";

@Injectable()
export class CheckoutSessionCompleteService {
    private readonly apiUrl: string;
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly configService: ConfigService,
        @InjectPinoLogger(CheckoutSessionCompleteService.name)
        private readonly logger: PinoLogger
    ) {
        this.apiUrl = this.configService.get<string>("BULKVS_API_URL");
    }

    /**
   * Send success email after signup.
   */
    async sendSignUpSuccessMail(user: User, billingPackageData: BillingPackage): Promise<boolean> {

        console.log('userPackageData', billingPackageData);

        const signupSuccessToEmail = process.env.SIGN_UP_NOTIFICATION_EMAIL;
        console.log('signupSuccessToEmail', signupSuccessToEmail);

        if (signupSuccessToEmail) {

            const fullName = `${user.userName} || ""}`.trim();
            const subject = ` New User Signup Notification: ${fullName}`;
            const body = `
            <p>Dear Team,</p>
            <p>A new user has successfully signed up:</p>
            <ul>
                <li><strong>Name:</strong> ${fullName}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Phone:</strong> ${user.phone || "N/A"}</li>
                <li><strong>Package:</strong> ${billingPackageData.name}</li>
                <li><strong>User ID:</strong> ${user.id}</li>
                <li><strong>User Status:</strong> ${user.status}</li>
            </ul>
            <p>Please ensure the user is welcomed and onboarded appropriately.</p>
            <br/>
            <p>Best regards,</p>
            <p>${process.env.COMPANY_NAME}</p> 
        `;

            // const signUpEmailData = await this.emailService.sendEmail({
            //     to: signupSuccessToEmail,
            //     subject,
            //     body,
            //     user_id: BigInt(user.id),
            //     // team_id: user.teamId ? BigInt(user.teamId) : undefined,
            // });

            // console.log('signUpEmailData', signUpEmailData);

            return true;

        }

        return false;

    }

    private async saveOrUpdateUserCardInfo(
        userId: bigint,
        customerId: string,
        stripe: Stripe,
        paymentIntentId?: string,
        setupIntentId?: string,
        subscriptionId?: string,
        now = new Date()
    ): Promise<void> {
        let maskedCard = '**** **** **** xxxx';
        let cardBrand = 'unknown';
        let cardExpMonth: number | null = null;
        let cardExpYear: number | null = null;
        let paymentMethodId: string | null = null;

        console.log('paymentIntentId', paymentIntentId);
        console.log('setupIntentId', setupIntentId);
        console.log('customerId', customerId);
        console.log('subscriptionId', subscriptionId);

        const agency = await getAgency(DEFAULT_AGENCY_NAME);

        if (paymentIntentId) {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            paymentMethodId = paymentIntent.payment_method as string;
            console.log('paymentIntentId paymentMethodId', paymentMethodId);
            // 🔐 Attach and set as default if not already
            if (paymentMethodId) {
                await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
                await stripe.customers.update(customerId, {
                    invoice_settings: { default_payment_method: paymentMethodId },
                });
            }
        } else if (setupIntentId) {
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
            paymentMethodId = setupIntent.payment_method as string;
            console.log('setupIntentId paymentMethodId', paymentMethodId);
            // Attach to customer
            await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
            await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
            });
        } else if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
            console.log('subscriptionId subscription', subscription);
            if (subscription.default_payment_method) {
                paymentMethodId = subscription.default_payment_method as string;
                console.log('subscriptionId paymentMethodId', paymentMethodId);
            } else {
                const invoiceId = subscription.latest_invoice as string;
                console.log('subscriptionId invoiceId', invoiceId);
                if (invoiceId) {
                    const invoice = await stripe.invoices.retrieve(invoiceId);
                    const paymentIntentId = invoice.payment_intent as string;
                    console.log('subscriptionId paymentIntentId', paymentIntentId);
                    if (paymentIntentId) {
                        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                        paymentMethodId = paymentIntent.payment_method as string;
                        console.log('subscriptionId paymentMethodId', paymentMethodId);
                    }
                }
            }
        } else if (customerId) {
            const response = await stripe.customers.retrieve(customerId);
            console.log('customerId response', response);
            if ('deleted' in response && response.deleted) {
                console.error(`Customer ${customerId} is deleted, cannot retrieve payment method.`);
            } else {
                const customer = response as Stripe.Customer;
                console.log('customerId customer', customer);
                paymentMethodId = customer.invoice_settings.default_payment_method as string;
            }
            console.log('customerId paymentMethodId', paymentMethodId);
        }

        console.log('paymentMethodId', paymentMethodId);

        if (paymentMethodId) {
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
            const card = paymentMethod.card;
            console.log('card', card);
            if (card) {
                maskedCard = `**** **** **** ${card.last4}`;
                cardBrand = card.brand;
                cardExpMonth = card.exp_month;
                cardExpYear = card.exp_year;
            }
        }

        console.log('maskedCard', maskedCard);
        console.log('cardBrand', cardBrand);
        console.log('cardExpMonth', cardExpMonth);
        console.log('cardExpYear', cardExpYear);

        const existingCard = await this.prisma.userCardInfo.findFirst({
            where: { userId, customerId },
        });

        if (existingCard) {
            await this.prisma.userCardInfo.update({
                where: { id: existingCard.id },
                data: {
                    cardNumber: maskedCard,
                    cardBrand,
                    cardExpMonth,
                    cardExpYear,
                    updatedAt: now
                },
            });
        } else {
            await this.prisma.userCardInfo.create({
                data: {
                    userId,
                    agencyId: agency.id,
                    cardNumber: maskedCard,
                    cardBrand,
                    cardExpMonth,
                    cardExpYear,
                    token: 'card',
                    customerId,
                    status: 'ACTIVE',
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }

        console.log(` Card info saved for user: ${userId} (Brand: ${cardBrand}, Last4: ${maskedCard.slice(-4)})`);
    }


    private async extractCheckoutMetadata(session: Stripe.Checkout.Session) {
        const metadata = session.metadata;
        if (!metadata?.user_id || !metadata?.tran_id || !metadata?.plan_id) {
            throw new BadRequestException('Missing required metadata in Stripe session');
        }

        const userId = BigInt(metadata.user_id);
        const teamId = metadata.team_id ? BigInt(metadata.team_id) : null;
        const packageId = BigInt(metadata.plan_id);
        const isTrial = metadata.isTrial === 'true';
        const paymentType = metadata.payment_type; // 'subscription' | 'one_time'
        const creditAmount = parseFloat(metadata.total_amount || '0');
        const now = new Date();

        return { userId, teamId, packageId, isTrial, paymentType, creditAmount, metadata, now };
    }

    /**
  * Handles the 'checkout.session.completed' event. Processes completed checkout sessions,
  * including trial activations and subscriptions, updates user card info, creates or updates
  * user packages, logs transactions, and sends notifications.
  */
    public async handleCheckoutSessionCompletedEvent(event: Stripe.Event, stripe: Stripe) {
        console.log('Processing checkout.session.completed event');

        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, teamId, packageId, isTrial, paymentType, creditAmount, metadata, now } =
            await this.extractCheckoutMetadata(session);

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            console.error(`User ${userId} not found`);
            return;
        }

        console.log('isTrial', isTrial);

        if (isTrial) {
            await this.processTrialSubscriptionCheckout(user, userId, teamId, packageId, session, stripe, creditAmount, now);
        } else {
            await this.processOneTimeCheckout(user, userId, teamId, packageId, session, stripe, creditAmount, now);
        }

    }

    private async processOneTimeCheckout(
        user: User,
        userId: bigint,
        teamId: bigint | null,
        packageId: bigint,
        session: Stripe.Checkout.Session,
        stripe: Stripe,
        creditAmount: number,
        now: Date
    ) {
        console.log("Processing One-Time Payment Checkout");

        const agency = await getAgency(DEFAULT_AGENCY_NAME);

        const packageData = await this.prisma.billingPackage.findUnique({
            where: { id: packageId },
        });
        if (!packageData) {
            throw new BadRequestException('Invalid package ID');
        }


        const userTransactionData = await this.prisma.billingTransaction.create({
            data: {
                userId: user.parentUserId ? user.parentUserId : user.id,
                createdBy: user.id,
                agencyId: agency.id,
                creditAmount: Number(packageData.chargeAmount),
                billingPackageId: packageId,
                type: TransactionType.OUT,
                transactionFor: 'PackagePurchase',
                createdAt: now,
                updatedAt: now,
            },
        });

        const cyclePeriod = packageData.cyclePeriod as CyclePeriod; // ensure correct type

        const nextBillingDate = new Date(now);

        if (cyclePeriod === CyclePeriod.MONTH) {
            nextBillingDate.setDate(nextBillingDate.getDate() + 29);
        } else if (cyclePeriod === CyclePeriod.YEAR) {
            nextBillingDate.setDate(nextBillingDate.getDate() + 364);
        } else if (cyclePeriod === CyclePeriod.LIFE_TIME) {
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 100);
        }


        const userPackage = await this.prisma.userPackage.create({
            data: {
                userId,
                agencyId: agency.id,
                packageId,
                status: UserPackageStatus.ACTIVE,
                trialMode: YesNo.NO,
                startDate: now,
                nextBillingDate: nextBillingDate,
                createdAt: now,
                updatedAt: now,
            },
        });

        await this.sendPackagePurchaseEmail(user, userId, teamId, packageId, creditAmount);

        this.notifyUI(userId, {
            event: 'payment_completed',
            userId,
            creditAmount,
            packageId,
        });

        console.log(` One-time payment completed for user: ${userId}`);

        let paymentIntentId: string | undefined = session.payment_intent as string;

        await this.saveOrUpdateUserCardInfo(
            userId,
            session.customer as string,
            stripe,
            paymentIntentId,
            undefined,
            session.subscription as string,
        );

        await this.sendSignUpSuccessMail(user, packageData);

    }

    private async processTrialSubscriptionCheckout(
        user: User,
        userId: bigint,
        teamId: bigint | null,
        packageId: bigint,
        session: Stripe.Checkout.Session,
        stripe: Stripe,
        creditAmount: number,
        now: Date
    ) {
        // Trial logic, userPackage creation with 'TRIALING'
        // Free credits addition
        // sendTrialActivationEmail
        // notifyUI
        const agency = await getAgency(DEFAULT_AGENCY_NAME);

        console.log("Processing Trial Subscription Checkout");

        const packageData = await this.prisma.billingPackage.findUnique({
            where: { id: packageId },
        });
        if (!packageData) {
            throw new BadRequestException('Invalid package ID');
        }

        const existingTrial = await this.prisma.userPackage.findFirst({
            where: { userId, trialMode: 'YES' },
        });
        if (existingTrial) {
            throw new BadRequestException('User already in a trial period');
        }

        const freeCreditAmount = packageData.trialFreeCredit || 0;
        const trialStart = now;
        const trialEnd = new Date(now);
        trialEnd.setDate(now.getDate() + 7);

        const userPackage = await this.prisma.userPackage.create({
            data: {
                userId,
                agencyId: agency.id,
                packageId,
                status: UserPackageStatus.TRIALING,
                trialStart,
                trialEnd,
                trialMode: YesNo.YES,
                startDate: now,
                nextBillingDate: trialEnd,
                createdAt: now,
                updatedAt: now,
            },
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { currentCredit: { increment: freeCreditAmount } },
        });

        await this.sendTrialActivationEmail(user, userId, teamId, packageId, creditAmount, trialEnd);

        this.notifyUI(userId, {
            event: 'trial_activated',
            userId,
            creditAmount,
            packageId,
        });

        console.log(` Trial subscription activated for user: ${userId}`);

        const setupIntentId = session.setup_intent ? session.setup_intent as string : undefined;

        console.log(` setupIntentId`, setupIntentId);

        await this.saveOrUpdateUserCardInfo(
            userId,
            session.customer as string,
            stripe,
            undefined,        // paymentIntentId not available
            setupIntentId,    // safe pass, may be undefined
            session.subscription as string,
        );

        await this.sendSignUpSuccessMail(user, packageData);

    }


    private notifyUI(userId: bigint, data: { event: string; userId: bigint; creditAmount: number; packageId: bigint | null }) {
        console.log("UI Notification:", data);
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
        //     to: user.email,
        //     subject,
        //     body,
        //     user_id: userId,
        //     // team_id: teamId,
        // });

        console.log(`Trial activation email sent successfully for user: ${userId}`);
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
        //     to: user.email,
        //     subject,
        //     body,
        //     user_id: userId,
        //     // team_id: teamId,
        // });
    }

}