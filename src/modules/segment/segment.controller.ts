import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AssignSegmentToMemberDto, BulkAddContactsDto, BulkDeleteContactsDto, CreateSegmentDto, GetContactsBySegmentIdDto, SegmentParamsDto, UpdateSegmentDto, SegmentListParamDto, SegmentListItemDto } from './dto/create-segment.dto';
import { SegmentService } from "./segment.service";
import { AuthGuard } from "@/common/guard/auth.guard";
import { LoginUser } from "../auth/dto/login-user.dto";
import { RequirePermission } from "@/common/decorator/require-permission.decorator";
import { AssetDTO } from "@/utils/AssetDTO";
import { PermissionDTO } from "@/utils/PermissionDTO";
import { PermissionGuard } from '../../common/guard/permission-guard';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';

interface AuthRequest extends Request {
    user: LoginUser;
}

@ApiTags("Segment")
@Controller("segments")
export class SegmentController {

    constructor(
        private readonly segmentService: SegmentService,
    ) { }

    @Get()
    @ApiBearerAuth()
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermission(
        AssetDTO.ofName(AssetDTO.SEGMENTS), // adjust if your Asset name differs
        PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
    )
    async getSegments(
        @Query() query: SegmentListParamDto,
        @Request() req: { user: LoginUser },
    ): Promise<ApiListResponseDto<SegmentListItemDto>> {
        const { user } = req;
        return this.segmentService.getSegment(user, query);
    }

    @ApiBearerAuth()
    @Post('')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
    async createSegment(@Req() req: AuthRequest, @Body() dto: CreateSegmentDto) {
        return this.segmentService.createSegment(req.user, dto);
    }

    // get segments
    @ApiBearerAuth()
    @Get('list')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.VIEW_PERMISSION_VALUE, PermissionDTO.VIEW_PERMISSION_NAME))
    async getSegmentList(
        @Req() req: AuthRequest,
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('name') name: string,
        @Query('status') status: string,
        @Query('sortBy') sortBy: string,
        @Query('sortOrder') sortOrder: 'asc' | 'desc'
    ) {
        // console.log('User data from req.user:', JSON.stringify(req.user, null, 2));
        const { id: userId, agencyId } = req.user;
        return this.segmentService.getSegments(userId, agencyId, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            name,
            status,
            sortBy,
            sortOrder,
        });
    }

    // get segment by :id
    @ApiBearerAuth()
    @Get(':id')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.VIEW_PERMISSION_VALUE, PermissionDTO.VIEW_PERMISSION_NAME))
    async getSegmentById(@Req() req: AuthRequest, @Param('id') id: SegmentParamsDto) {
        const { id: userId, agencyId } = req.user;
        return this.segmentService.getSegmentById(userId, agencyId, Number(id));
    }

    // update segment
    @ApiBearerAuth()
    @Put(':id')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.EDIT_PERMISSION_VALUE, PermissionDTO.EDIT_PERMISSION_NAME))
    async updateSegment(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSegmentDto) {
        // console.log("dto on controller", dto);
        // console.log("type of name", typeof dto.name);
        const { id: userId, agencyId } = req.user;
        return this.segmentService.updateSegment(userId, agencyId, id, dto);
    }

    // delete segment
    @ApiBearerAuth()
    @Delete(':id')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.TAGS), PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME))
    async deleteSegment(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
        // console.log("params on controller", params, typeof params);
        const { id: userId, agencyId } = req.user;
        return this.segmentService.deleteSegment(userId, agencyId, id);
    }

    // contact listing with segmentid with pagination get
    @ApiBearerAuth()
    @Get(':id/contacts-list')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.VIEW_PERMISSION_VALUE, PermissionDTO.VIEW_PERMISSION_NAME))
    async getContactsForSegment(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number, @Query() dto: GetContactsBySegmentIdDto) {
        // console.log("dto on controller", dto);
        const { id: userId, agencyId } = req.user;
        return this.segmentService.getContactsBySegmentId(userId, agencyId, id, dto);
    }


    // bulk add more contacts to segment with array of contactIds
    @ApiBearerAuth()
    @Post(':id/add-more-contacts')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
    async addContactsToSegment(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: BulkAddContactsDto) {
        // console.log("Adding contacts to segment ID:", id);
        // console.log("Contacts to add:", dto.contactIds);
        // console.log("User data from req.user:", JSON.stringify(req.user, null, 2));
        return this.segmentService.addContactsToSegment(req.user, id, dto.contactIds.map((contactId) => BigInt(contactId)));
    }

    // contact from segment delete
    @ApiBearerAuth()
    @Delete(':id/delete-contacts/:contactId')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME))
    async deleteContactsBySegmentId(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number, @Param('contactId', ParseIntPipe) contactId: number) {
        const { id: userId, agencyId } = req.user;
        return this.segmentService.deleteContactsBySegmentId(userId, agencyId, id, contactId);
    }


    // bulk delete contacts from segment with array of contactIds
    @ApiBearerAuth()
    @Post(':id/bulk-delete-contacts')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.TAGS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
    async bulkDeleteContactsBySegmentId(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: BulkDeleteContactsDto) {
        // console.log(" Bulk deleting contacts from segment ID:", id);
        // console.log("Contacts to delete:", dto.contactIds);
        const { id: userId, agencyId } = req.user;
        return this.segmentService.bulkDeleteContactsBySegmentId(userId, agencyId, id, dto.contactIds.map((id) => BigInt(id)));
    }


    // assign segment to team member
    @ApiBearerAuth()
    @Post('assign-to-member')
    @UseGuards(AuthGuard)
    @RequirePermission(AssetDTO.of(0n, AssetDTO.SEGMENTS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
    async assignSegmentToMember(@Req() req: AuthRequest, @Body() dto: AssignSegmentToMemberDto) {
        const { id: userId, agencyId } = req.user;
        return this.segmentService.assignSegmentToMember(userId, agencyId, dto);
    }
}