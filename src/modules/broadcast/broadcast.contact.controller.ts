import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Request,
    UseGuards,
    BadRequestException,
    Put,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { LoginUser } from '../auth/dto/login-user.dto';
import { AuthGuard } from '@/common/guard/auth.guard';
import { PermissionGuard } from '@/common/guard/permission-guard';
import { RequirePermission } from '@/common/decorator/require-permission.decorator';
import { AssetDTO } from '@/utils/AssetDTO';
import { PermissionDTO } from '@/utils/PermissionDTO';
import { BroadcastService } from './broadcast.service';
import {
    AddBroadcastContactsDto,
    BroadcastContactListItemDto,
    BroadcastContactListParamDto,
    PauseResumeContactsDto,
    UnsubscribeContactsDto,
} from './dto/broadcast.dto';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { ApiDeleteResponseDto } from '../../common/dto/api-delete-response.dto';
import { ApiUpdateResponseDto } from '../../common/dto/api-update-response.dto';

@ApiTags('Broadcasts > Contacts')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller('broadcasts/:broadcastId/contacts')
export class BroadcastContactsController {
    constructor(private readonly broadcastService: BroadcastService) { }

    /**
     * GET /broadcasts/:broadcastId/contacts
     */
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
    )
    @Get()
    @ApiParam({ name: 'broadcastId', type: Number, example: 123 })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'perPage', required: false, example: 10 })
    @ApiQuery({ name: 'query', required: false, example: 'john' })
    async getBroadcastContacts(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Query() query: BroadcastContactListParamDto,
        @Request() req: { user: LoginUser },
    ): Promise<
        ApiListResponseDto<BroadcastContactListItemDto> & {
            responseCode: number;
            success: boolean;
        }
    > {
        if (!Number.isFinite(broadcastId) || broadcastId <= 0) {
            throw new BadRequestException('Invalid broadcastId');
        }

        const result = await this.broadcastService.getBroadcastContacts(
            req.user,
            broadcastId,
            query,
        );

        console.log('result: ', result);

        return {
            ...result,
            responseCode: result.statusCode,
            success: result.statusCode >= 200 && result.statusCode < 300,
        };
    }

    /**
     * POST /broadcasts/:broadcastId/contacts
     * Body:
     *  - contact list: { "type": "contactList", "Ids": [1,2,3] }
     *  - segments:     { "type": "segment",     "Ids": [101,102] }
     *
     * Note: broadcastId is taken from the path; we patch the DTO to match.
     */
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
    )
    @Post()
    @ApiParam({ name: 'broadcastId', type: Number, example: 123 })
    @ApiBody({
        description: 'Attach contacts (or contacts from segments) to a broadcast',
        type: AddBroadcastContactsDto,
        examples: {
            contactList: {
                summary: 'Contact list example',
                value: { type: 'contactList', Ids: [1, 2, 3] },
            },
            segment: {
                summary: 'Segments example',
                value: { type: 'segment', Ids: [101, 102] },
            },
        },
    })
    async addContactsToBroadcast(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Body() dto: AddBroadcastContactsDto,
        @Request() req: { user: LoginUser },
    ): Promise<ApiUpdateResponseDto<any>> {
        // Ensure path id wins
        (dto as any).broadcastId = broadcastId;

        const result = await this.broadcastService.addContactsToBroadcast(
            broadcastId,
            dto,
            req.user,
        );

        return {
            statusCode: 200,
            message: result?.message || 'Contacts queued/attached to broadcast successfully.',
            data: result?.data ?? dto ?? null,
        };
    }

    /**
     * DELETE /broadcasts/:broadcastId/contacts
     * Body: { "contactIds": number[] }
     *
     * (We use path broadcastId; DTO no longer needs broadcastId explicitly.)
     */
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME), // or DELETE if that’s your policy
    )
    @Delete()
    @HttpCode(200)
    @ApiParam({ name: 'broadcastId', type: Number, example: 12 })
    @ApiBody({
        description: 'Unsubscribe contacts from a broadcast',
        type: UnsubscribeContactsDto,
        examples: {
            sample: {
                summary: 'Example payload',
                value: { contactIds: [1001, 1002, 1003] },
            },
        },
    })
    async unsubscribeContacts(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Body() dto: UnsubscribeContactsDto,
        @Request() req: { user: LoginUser },
    ): Promise<ApiDeleteResponseDto> {
        // Patch DTO with path id for service logic
        const payload = { ...dto, broadcastId };

        const result = await this.broadcastService.unsubscribeContacts(
            req.user,
            payload,
            broadcastId
        );

        return {
            statusCode: 200,
            message: result?.message || 'Contacts unsubscribed successfully.',
        };
    }


    /**
       * PUT /broadcasts/:broadcastId/contacts
       * Body: { "contactIds": number[], "action": "Pause" | "Resume" }
       *
       * (We use path broadcastId; DTO no longer needs broadcastId explicitly.)
       */
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.BROADCASTS),
        PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
    )
    @Put()
    @HttpCode(200)
    @ApiParam({ name: 'broadcastId', type: Number, example: 12 })
    @ApiBody({
        description: 'Pause or Resume contacts in a broadcast',
        type: PauseResumeContactsDto,
        examples: {
            pauseExample: {
                summary: 'Pause contacts in a broadcast',
                value: { contactIds: [2001, 2002, 2003], action: 'Pause' },
            },
            resumeExample: {
                summary: 'Resume contacts in a broadcast',
                value: { contactIds: [2001, 2002, 2003], action: 'Resume' },
            },
        },
    })
    async updateContactsAction(
        @Param('broadcastId', ParseIntPipe) broadcastId: number,
        @Body() dto: PauseResumeContactsDto,
        @Request() req: { user: LoginUser },
    ): Promise<ApiDeleteResponseDto> {
        // Attach path param into payload
        const payload = { ...dto, broadcastId };

        let result;
        if (dto.action === 'Pause') {
            result = await this.broadcastService.pauseContacts(req.user, broadcastId, payload);
        } else if (dto.action === 'Resume') {
            result = await this.broadcastService.resumeContacts(req.user, broadcastId, payload);
        } else {
            return {
                statusCode: 400,
                message: 'Invalid action. Allowed: Pause or Resume',
            };
        }

        return {
            statusCode: 200,
            message: result?.message || `Contacts ${dto.action.toLowerCase()}d successfully.`,
        };
    }


}
