import { Module } from "@nestjs/common";
import { TokenService } from "../auth/token.service";
import { RedisModule } from "../redis/redis.module";
import { UserModule } from "../user/user.module";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { StripeGateway } from "./Stripe.payment";
import { EmailService } from "../email/email.service";
import { HttpModule, HttpService } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AutoRechargeService } from "./autorecharge.service";
import { CheckoutSessionCompleteService } from "./checkoutsessioncomplete.service";
import { StripeWebhookService } from "./stripe.webhook.service";
import { GA4Service } from "../common/ga4.service";

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, TokenService, StripeGateway, EmailService, AutoRechargeService, CheckoutSessionCompleteService, StripeWebhookService, GA4Service],
  imports: [RedisModule, UserModule, HttpModule, ConfigModule],
  exports: [PaymentService, StripeGateway]
})
export class PaymentModule { }
