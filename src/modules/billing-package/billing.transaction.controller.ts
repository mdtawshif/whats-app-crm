import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Request,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { BillingService } from './billing-package.service'
import { AuthGuard } from '../../common/guard/auth.guard'
import { LoginUser } from '../auth/dto/login-user.dto'
import { RoleGuard } from '../../common/guard/role-guard'
import { RequiredRole } from '../../common/decorator/require-role.decorator'
import { RoleDTO } from '../../utils/RoleDTO'
import {
  BillingPackageRequestDto,
  BillingTransactionResponse,
  CreateBillingPackageDto,
  DeleteBillingPackageDto,
  UpdateBillingPackageDto
} from './dto/create.billing-package'
import { BillingTransactionService } from './billing-transaction.service'
import { RequirePermission } from '@/common/decorator/require-permission.decorator'
import { AssetDTO } from '@/utils/AssetDTO'
import { PermissionGuard } from '@/common/guard/permission-guard'
import { PermissionDTO } from '@/utils/PermissionDTO'
import { PaginationInfo } from '@/common/helpers/pagination.info'

@ApiTags('Billing Transactions')
@Controller('billing-transactions')
export class BillingTransactionController {
  constructor( private readonly billingTransactionService: BillingTransactionService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.BILLING),
    PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME)
  )
  async getSettingsStatsDetails(
    @Request() req: { user: LoginUser },
    @Query('currentPage') currentPage?: number,
    @Query('perPage') perPage?: number): Promise<{pagination: PaginationInfo,data: BillingTransactionResponse[]}> {
    
        currentPage = currentPage ? currentPage : 1
        perPage = perPage ? perPage : 20

        const userId = req.user.parentUserId ? req.user.parentUserId : req.user.id
        const result = await this.billingTransactionService.getUserTransations(userId, currentPage, perPage)
        console.log("result.total", result.total);
        const pagination = new PaginationInfo(Number(result.total), currentPage, perPage)

     return {
        pagination,
        data: result.data
    }
  }
}
