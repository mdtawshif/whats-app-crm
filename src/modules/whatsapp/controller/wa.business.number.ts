import { RequirePermission } from "@/common/decorator/require-permission.decorator";
import { PermissionGuard } from "@/common/guard/permission-guard";
import { AssetDTO } from "@/utils/AssetDTO";
import { PermissionDTO } from "@/utils/PermissionDTO";
import { Controller, Get, Query, Req, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { LoginUser } from "src/modules/auth/dto/login-user.dto";
import { GetAllNumberShortDto, WaNumberDto } from "../dto/wab.number.register.dto";
import { PrismaService } from "nestjs-prisma";
import { ApiListResponseDto } from '../../../common/dto/api-list-response.dto';
import { AuthGuard } from "@/common/guard/auth.guard";
import { GetWaBusinessNumbersDto } from "../dto/get-wa-business-numbers.dto";
import { WaBusinessNumberService } from "../service/wa.business.number.service";

@Controller('wab-numbers')
@ApiTags('WabNumbers')
export class WaBusinessNumberController {
    constructor(
        @InjectPinoLogger(WaBusinessNumberController.name)
        private readonly logger: PinoLogger,
        private readonly waBusinessNumberService: WaBusinessNumberService,
        private readonly prisma: PrismaService
    ) { }


    //find all wab numbers
    @Get("list")
    @ApiBearerAuth()
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.WHATSAPP_PROFILES),
        PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
    )
    async findAll(
        @Req() { user }: { user: LoginUser },
        @Query() query: GetWaBusinessNumbersDto,
    ) {
        return this.waBusinessNumberService.getWaBusinessNumbers(user, query);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.WHATSAPP_PROFILES),
        PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
    )
    async getAllShort(
        @Query() query: GetAllNumberShortDto,
        @Request() request: { user: LoginUser },
    ): Promise<ApiListResponseDto<WaNumberDto>> {

        try {

            const { wabaId } = query as any;

            if (!wabaId) {
                return { statusCode: 400, message: 'wabaId is required', data: [] };
            }

            const rows = await this.prisma.$queryRaw<WaNumberDto[]>`
                SELECT
                    CAST(n.id AS CHAR)     AS id,
                    n.phone_number_id      AS phoneNumberId,
                    n.display_phone_number AS displayPhoneNumber,
                    n.number               AS number
                FROM wa_business_numbers AS n
                JOIN wa_business_accounts AS a
                    ON a.id = n.wa_business_account_id
                WHERE a.wabaId = ${wabaId}
                ORDER BY n.id DESC
                `;

            return {
                statusCode: 200,
                message: 'Get WhatsApp Business Numbers (short).',
                data: rows,
            };

        } catch (error) {
            this.logger.error(error);
            return {
                statusCode: 500,
                message: 'An error occurred while fetching numbers.',
                data: [],
            };
        }

    }

}
