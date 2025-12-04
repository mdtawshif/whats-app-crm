import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing-package.service';
import { AuthGuard } from '../../common/guard/auth.guard';
import { LoginUser } from '../auth/dto/login-user.dto';
import { RoleGuard } from '../../common/guard/role-guard';
import { RequiredRole } from '../../common/decorator/require-role.decorator';
import { RoleDTO } from '../../utils/RoleDTO';
import {
  BillingPackageRequestDto,
  CreateBillingPackageDto,
  DeleteBillingPackageDto,
  UpdateBillingPackageDto,
} from './dto/create.billing-package';

@ApiTags('Billing Package')
@Controller('billing-packages')
export class BillingPackageController {
  constructor(private readonly billingService: BillingService) { }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @Get('/get-all-billing-packages')
  @RequiredRole(RoleDTO.of(0n, RoleDTO.SUPER_ADMIN_ROLE_NAME, 0n))
  async getAllBillingPackages(@Request() req: { user: LoginUser }) {
    return this.billingService.getAllBillingPackages();
  }

  @ApiBearerAuth()
  @Get('/get-billing-packages')
  async getBillingPackages() {
    return this.billingService.getBillingPackages();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('/create-billing-package')
  async createBillingPackage(
    @Request() req: { user: LoginUser },
    @Body() dto: CreateBillingPackageDto,
  ) {
    return this.billingService.createBillingPackage(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('/archive-billing-package')
  async archiveBillingPackage(
    @Request() req: { user: LoginUser },
    @Body() dto: BillingPackageRequestDto,
  ) {
    return this.billingService.archiveBillingPackage(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('/activate-billing-package')
  async activateBillingPackage(
    @Request() req: { user: LoginUser },
    @Body() dto: BillingPackageRequestDto,
  ) {
    return this.billingService.activateBillingPackage(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('/update-billing-package')
  async updateBillingPackage(
    @Request() req: { user: LoginUser },
    @Body() dto: UpdateBillingPackageDto,
  ) {
    return this.billingService.updateBillingPackage(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete('/delete-billing-package')
  async deleteBillingPackage(
    @Request() req: { user: LoginUser },
    @Query() dto: DeleteBillingPackageDto,
  ) {
    return this.billingService.deleteBillingPackage(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('user-billing-overview')
  async getAccountOverview(
    @Request() req: { user: LoginUser },
  ) {
    return this.billingService.getAccountOverview(req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put("update-user-package")
  async updateUserPackage(
    @Request() req: { user: LoginUser },
    @Query() dto: BillingPackageRequestDto
  ) {
    return this.billingService.updateUserPackage(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put("change-package")
  async changplan(
  ) {
    return this.billingService.getQueuedRequestsScheduledForToday();
  }
}
