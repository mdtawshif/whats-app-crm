import { Body, Controller, HttpException, HttpStatus, Param, Post, Req, Request, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ManualTopUpDto } from './dto/create-manual-top-up.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { LoginUser } from '../auth/dto/login-user.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RequirePermission } from '@/common/decorator/require-permission.decorator';
import { AssetDTO } from '@/utils/AssetDTO';
import { PermissionDTO } from '@/utils/PermissionDTO';
import { PermissionGuard } from '@/common/guard/permission-guard';
import { RoleGuard } from '@/common/guard/role-guard';
import { RequiredRole } from '@/common/decorator/require-role.decorator';
import { RoleDTO } from '@/utils/RoleDTO';
import { AutoRechargeService } from './autorecharge.service';

@ApiTags("Payment")
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService,
    private readonly autoRechargeService: AutoRechargeService
  ) { }

  @ApiBearerAuth()
  @Post('initialize')
  async initializeStripePayment(
    @Body() dto: InitializePaymentDto) {
    console.log('PaymentController dto: ', dto);
    return this.paymentService.initializeStripePayment(dto);
  }

  @ApiBearerAuth()
  @Post('webhook')
  async handleStripeWebhook(@Req() req: Request) {
    console.log('stripe webhoook');
    return this.paymentService.handleStripeWebhook(req);
  }

  @ApiBearerAuth()
  @Post("manual-topup")
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.of(0n, RoleDTO.ADMIN_ROLE_NAME, 0n))
  async manualTopUp(
    @Request() request: { user: LoginUser },
    @Body() dto: ManualTopUpDto) {
    return this.paymentService.manualTopUp(request.user, dto);
  }

  @ApiBearerAuth()
  @Post("change-payment-method")
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.of(0n, RoleDTO.ADMIN_ROLE_NAME, 0n))
  async updateDefaultPaymentMethod(
    @Body('paymentMethodId') paymentMethodId: string,
    @Request() request: { user: LoginUser }
  ) {
    if (!paymentMethodId) {
      throw new HttpException('paymentMethodId is required', HttpStatus.BAD_REQUEST);
    }
    return this.paymentService.updateDefaultPaymentMethod(request.user, paymentMethodId);
  }

  @ApiBearerAuth()
  @Post('cancel-subscriptions')
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.of(0n, RoleDTO.ADMIN_ROLE_NAME, 0n))
  async cancelSubscriptions(
    @Request() request: { user: LoginUser },
    @Body() dto: CancelSubscriptionDto
  ) {
    return this.paymentService.cancelUserSubscription(request.user, dto);
  }

  @ApiBearerAuth()
  @Post('process-cancel')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.of(0n, AssetDTO.PAYMENTS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
  async testCancelSubscriptions() {
    await this.paymentService.processCancelSubscriptions();
    return { message: 'Cancel subscriptions processed successfully' };
  }

    @ApiBearerAuth()
  @Post('autore')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.of(0n, AssetDTO.PAYMENTS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
  async autore() {
    await this.autoRechargeService.handleAutoRecharges();
    return { message: 'Auto recharges processed successfully' };
  }
}
