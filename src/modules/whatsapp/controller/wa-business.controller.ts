import { RequirePermission } from "@/common/decorator/require-permission.decorator";
import { AuthGuard } from "@/common/guard/auth.guard";
import { PermissionGuard } from "@/common/guard/permission-guard";
import { AssetDTO } from "@/utils/AssetDTO";
import { PermissionDTO } from "@/utils/PermissionDTO";
import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LoginUser } from "src/modules/auth/dto/login-user.dto";
import { returnSuccess } from "@/common/helpers/response-handler.helper";
import { HttpStatusCode } from "axios";
import { WaBusinessAccountService } from "../service/wa.business.account.service";

@Controller('wa-business-account')
@ApiTags('Whats app business account')
export class WaBusinessAccountController {
  constructor(
    private readonly waBusinessAccountService: WaBusinessAccountService
  ) { }

  @Get('/')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.WHATSAPP_PROFILES), PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME))
  async getWhatsAppBusinessAccount(
    @Request() request: { user: LoginUser }
  ) {
    const res = await this.waBusinessAccountService.getNameAndIdByUser(request.user.id);
    return returnSuccess(
      HttpStatusCode.Ok,
      'WABA fetched successfully',
      res
    );
  }
}
