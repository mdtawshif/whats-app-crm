import { RequirePermission } from "@/common/decorator/require-permission.decorator";
import { AuthGuard } from "@/common/guard/auth.guard";
import { PermissionGuard } from "@/common/guard/permission-guard";
import { AssetDTO } from "@/utils/AssetDTO";
import { PermissionDTO } from "@/utils/PermissionDTO";
import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LoginUser } from "src/modules/auth/dto/login-user.dto";
import { WaMessagingSendDto } from "../dto/wa-messaging.dto";
import { WaMessagingService } from "../service/wa.messaging.service";

@Controller('wa-messages')
@ApiTags('Whats app messaging')
export class WaMessagingController {
  constructor(
    private readonly waMessagingService: WaMessagingService,
  ) { }

  @Post('/send')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(AssetDTO.ofName(AssetDTO.INBOX), PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME))
  async sendWhatsAppMessage(
    @Body() body: WaMessagingSendDto,
    @Request() request: { user: LoginUser }
  ) {
    return await this.waMessagingService.sendMessage({body: body, user: request.user});
  }
}
