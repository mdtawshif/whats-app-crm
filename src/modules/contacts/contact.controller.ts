import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiParam, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto, BulkCreateContactDto, UploadContactsDto, GetContactsDto, UpdateContactDto, type GetContactQueueListDto, GetMemberContactsDto, GetContactQueueListForFilterDto, } from './dto/index.dto';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { AssignTagMultipleDto, AssignTagSingleDto, RemoveTagDto } from './dto/tag-assign.dto';
import { AssignContactsDto, DeleteContactDto, RemoveContactAssignmentsDto, ContactListParamDto, ContactListItemDto, AssignWaAccountsToMemberDto, GetAssignedWhatsAppNumbersDto, UnassignWhatsAppNumberDto } from './dto/assign-contact.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { ApiKeyGuard } from '../../common/guard/api-key.guard';
import { RequirePermission } from '../../common/decorator/require-permission.decorator';
import { AssetDTO } from '../../utils/AssetDTO';
import { PermissionDTO } from '../../utils/PermissionDTO';
import { LoginUser } from '../auth/dto/login-user.dto';
import { ContactUploadService } from './contact-upload/contact-upload.service';
import { PermissionGuard } from '../../common/guard/permission-guard';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { ApiViewResponseDto } from '../../common/dto/api-view-response.dto';
import { ContactSummary } from './dto/get-contacts.dto';
import { BasePaginationDto } from '@/common/dto/base-pagination.dto';

@ApiTags('Contacts')
@Controller('contacts')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly contactUploadService: ContactUploadService,
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService
  ) {
    this.logger.setContext(ContactController.name);
  }

  @Get('summary')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.CONTACTS), // adjust if your asset key differs
    PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
  )
  @ApiOperation({ summary: 'Get overall contact summary' })
  @ApiResponse({ status: 200, description: 'Returns summary of contacts' })
  async getContactSummary(@Request() req: { user: LoginUser }): Promise<ApiViewResponseDto<ContactSummary>> {
    return this.contactService.getContactSummary(req.user);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(
    AssetDTO.ofName(AssetDTO.CONTACTS), // adjust if your asset key differs
    PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
  )
  async getContacts(
    @Query() query: ContactListParamDto,
    @Request() req: { user: LoginUser },
  ): Promise<ApiListResponseDto<ContactListItemDto>> {

    return this.contactService.getContacts(req.user, query);

  }

  @ApiBearerAuth()
  @Post('manual-add-contact')
  @UseGuards(AuthGuard)
  async createSingle(@Request() req: { user: LoginUser }, @Body() dto: CreateContactDto) {
    // const { id: userId, agencyId } = req.user;
    return this.contactService.createSingleContact(req.user, dto);
  }

  @ApiBearerAuth()
  @Post('add-contact-by-api-key')
  @UseGuards(ApiKeyGuard)
  async createSingleByApiKey(@Request() req: { user: LoginUser }, @Body() dto: CreateContactDto) {
    return this.contactService.createSingleContact(req.user, dto);
  }

  @ApiBearerAuth()
  @Get('list')
  @UseGuards(AuthGuard)
  async getList(@Request() req: { user: LoginUser }, @Query() dto: GetContactsDto) {
    // console.log("dto on controller", dto);
    // const userId = BigInt(1);
    return this.contactService.getContactList(req.user, dto);
  }

  // delete contacts with contactIds
  @ApiBearerAuth()
  @Delete('delete-contacts')
  @RequirePermission(AssetDTO.of(0n, AssetDTO.CONTACTS), PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME))
  @UseGuards(AuthGuard)
  async deleteContact(
    @Request() req: { user: LoginUser },
    @Body() dto: DeleteContactDto
  ) {
    return this.contactService.deleteContacts(req.user, dto.contactIds);
  }

  @ApiBearerAuth()
  @Delete('delete-all-contact')
  @RequirePermission(AssetDTO.of(0n, AssetDTO.CONTACTS), PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME))
  @UseGuards(AuthGuard)
  async deleteAllContact(@Request() req: { user: LoginUser }) {
    return this.contactService.deleteAllContact(req.user);
  }

  @ApiBearerAuth()
  @Post('bulk')
  @UseGuards(AuthGuard)
  async createBulk(@Request() req: { user: LoginUser }, @Body() dto: BulkCreateContactDto) {
    return this.contactService.createBulkContacts(req.user, dto);
  }

  @Post('upload')
  @UseGuards(AuthGuard)
  async uploadContactsCsvFile(@Request() req: { user: LoginUser }, @Body() dto: UploadContactsDto) {
    return this.contactUploadService.uploadContactsCsvFile(req.user, dto);
  }
  //contact Queue
  @Get('contact-queue-list')
  @UseGuards(AuthGuard)
  async getContactQueueList(
    @Request() req: { user: LoginUser },
    @Query() dto: GetContactQueueListDto,
  ) {
    return this.contactService.getContactQueueList(req.user, dto);
  }

  // contact-queue-list-for-filter
  @ApiBearerAuth()
  @Get('contact-queue-list-for-filter')
  @UseGuards(AuthGuard)
  async getContactQueueListForFilter(
    @Request() req: { user: LoginUser },
    @Query() dto: GetContactQueueListForFilterDto,
  ) {
    return this.contactService.getContactQueueListForFilter(req.user, dto);
  }

  @ApiBearerAuth()
  @Delete('contact-queue/:id')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'id', type: 'string' })
  async deleteUpload(@Request() req: { user: LoginUser }, @Param('id') id: string) {
    return this.contactService.deleteUpload(req.user, BigInt(id));
  }


  @ApiBearerAuth()
  @Get('details/:id')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'id', type: 'string' })
  async getDetail(@Request() req: { user: LoginUser }, @Param('id') id: string) {
    return this.contactService.getContactDetails(req.user, BigInt(id));
  }

  @ApiBearerAuth()
  @Put('update/:id')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'id', type: 'string' })
  async update(@Request() req: { user: LoginUser }, @Param('id') id: bigint, @Body() dto: UpdateContactDto) {
    return this.contactService.updateContact(req.user, dto, id);
  }


  @ApiBearerAuth()
  @Post('disconnect-google-sheet/:id')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'id', type: 'string' })
  async disconnectGoogleSheet(@Request() req: { user: LoginUser }, @Param('id') id: string) {
    return this.contactService.disconnectGoogleSheet(req.user, BigInt(id));
  }


  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('tag/assign-to-single-contact')
  async assignSingle(@Request() req: { user: LoginUser }, @Body() dto: AssignTagSingleDto) {
    return this.contactService.assignTagsToContact(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('tag/assign-multiple-contacts')
  async assignMultiple(@Request() req: { user: LoginUser }, @Body() dto: AssignTagMultipleDto) {
    return this.contactService.assignTagsToMultipleContacts(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('tag/remove-tag')
  async removeTag(@Request() req: { user: LoginUser }, @Body() dto: RemoveTagDto) {
    return this.contactService.removeTagFromContact(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @RequirePermission(AssetDTO.of(0n, AssetDTO.CONTACTS), PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME))
  @Post('assign-to-member')
  async assignToMember(@Request() req: { user: LoginUser }, @Body() dto: AssignContactsDto) {
    return this.contactService.assignContactToTeamMember(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @RequirePermission(AssetDTO.of(0n, AssetDTO.CONTACTS), PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME))
  @Delete('remove-contact-from-member')
  async removeContactsFromMember(@Request() req: { user: LoginUser }, @Body() query: RemoveContactAssignmentsDto) {
    return this.contactService.removeContactsFromMember(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @RequirePermission(AssetDTO.of(0n, AssetDTO.CONTACTS), PermissionDTO.of(PermissionDTO.VIEW_PERMISSION_VALUE, PermissionDTO.VIEW_PERMISSION_NAME))
  @Get('member-contacts')
  async getMemberContacts(@Request() req: { user: LoginUser }, @Query() dto: GetMemberContactsDto) {
    return this.contactService.getContactsOfMember(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @RequirePermission(
    AssetDTO.of(0n, AssetDTO.CONTACTS),
    PermissionDTO.of(PermissionDTO.CREATE_PERMISSION_VALUE, PermissionDTO.CREATE_PERMISSION_NAME)
  )
  @Post('team/members/:memberId/assign-wa-accounts')
  async assignWaAccountsToMember(
    @Request() req: { user: LoginUser },
    @Param('memberId') memberId: string,
    @Body() dto: AssignWaAccountsToMemberDto
  ) {
    return this.contactService.assignOrUpdateWhatsAppNumberAssignmentBulk(req.user, +memberId, dto.accounts);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @RequirePermission(
    AssetDTO.of(0n, AssetDTO.CONTACTS),
    PermissionDTO.of(PermissionDTO.DELETE_PERMISSION_VALUE, PermissionDTO.DELETE_PERMISSION_NAME)
  )
  @Put('team-members-whatsapp-number-unassign/:memberId')
  @ApiOperation({ summary: 'Unassign WhatsApp numbers from a team member' })
  async unassignWhatsAppNumberFromMember(
    @Request() req: { user: LoginUser },
    @Param('memberId') memberId: string,
    @Body() dto: UnassignWhatsAppNumberDto,
  ) {
    return this.contactService.unassignWhatsAppNumberFromMember(
      req.user,
      BigInt(memberId),
      dto.accounts
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @RequirePermission(
    AssetDTO.of(0n, AssetDTO.CONTACTS),
    PermissionDTO.of(PermissionDTO.VIEW_PERMISSION_VALUE, PermissionDTO.VIEW_PERMISSION_NAME)
  )
  @Get('get-whatsapp-number-list')
  async getWhatsAppNumberList(@Request() req: { user: LoginUser }) {
    return this.contactService.getWhatsAppNumberList(req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('whatsapp-number-assigned-list')
  async getAssignedWhatsAppNumbers(
    @Request() req: { user: LoginUser },
    @Query() dto: GetAssignedWhatsAppNumbersDto
  ) {
    return this.contactService.getAssignedWhatsAppNumbers(req.user, dto);
  }

}