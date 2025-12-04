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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TeamService } from "./team.service";
import { AddTeamMemberDto, CreateTeamDto, GetSegmentsDto, GetTeamListDto, GetTeamMembersDto, UpdateTeamDto } from "./dto/create-team.dto";
import { DeleteTeamDto, DeleteTeamMemberDto, UpdateTeamMemberDto } from "./dto/edit-team.dto";
import { LoginUser } from "../auth/dto/login-user.dto";
import { AuthGuard } from '../../common/guard/auth.guard';
import { RoleGuard } from "@/common/guard/role-guard";
import { RequiredRole } from "@/common/decorator/require-role.decorator";
import { RoleDTO } from "@/utils/RoleDTO";
import { IsMailVerified } from "@prisma/client";
import { returnError } from "@/common/helpers/response-handler.helper";
import { GetContactsDto } from "../contacts/dto/get-contacts.dto";

@ApiTags("Team")
@Controller("teams")
export class TeamController {
  constructor(readonly teamService: TeamService) { }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post("create")
  async createTeam(
    @Request() req: { user: LoginUser },
    @Body() dto: CreateTeamDto
  ) {
    return this.teamService.createTeam(dto, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Put("update-team")
  async updateTeam(
    @Request() req: { user: LoginUser },
    @Body() dto: UpdateTeamDto
  ) {
    return this.teamService.updateTeam(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("members-list")
  async getMyTeamMembers(
    @Request() req: { user: LoginUser },
    @Query() query: GetTeamMembersDto
  ) {
    return this.teamService.getTeamMembers(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Delete("delete-member")
  async deleteTeamMember(
    @Request() req: { user: LoginUser },
    @Query() query: DeleteTeamMemberDto
  ) {
    return this.teamService.deleteTeamMember(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Put("edit-member")
  async editTeamMember(
    @Request() req: { user: LoginUser },
    @Body() dto: UpdateTeamMemberDto
  ) {
    return this.teamService.updateTeamMember(req.user, dto);
  }


  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Post("add-member")
  async addTeamMember(
    @Request() req: { user: LoginUser },
    @Body() dto: AddTeamMemberDto
  ) {
    const isValid = req.user.isMailVerified;
    if (isValid === IsMailVerified.NO) {
      return returnError(400, "Please verify your email to add new member.");
    }
    return this.teamService.addMemberUnderUser(req.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("list")
  async getTeamList(
    @Request() req: { user: LoginUser },
    @Query() query: GetTeamListDto
  ) {
    return this.teamService.getTeamList(req.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @RequiredRole(RoleDTO.ofName(RoleDTO.ADMIN_ROLE_NAME), RoleDTO.ofName(RoleDTO.SUPER_ADMIN_ROLE_NAME))
  @Delete("delete")
  async deleteTeam(@Request() req: { user: LoginUser }, @Query() query: DeleteTeamDto) {
    return this.teamService.deleteTeam(req.user, query);
  }

  // get contact list to assign to team member
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("contact-list")
  async getContactList(@Request() req: { user: LoginUser }, @Query() dto: GetContactsDto) {
    // console.log("dto on controller", dto);
    return this.teamService.getContactList(req.user, dto);
  }


  // get segment list to assign to team member
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get("segment-list")
  async getSegmentList(@Request() req: { user: LoginUser }, @Query() dto: GetSegmentsDto) {

    // console.log("dto on controller", dto);
    return this.teamService.getSegmentList(req.user, dto);
  }

}
