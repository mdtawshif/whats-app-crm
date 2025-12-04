import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { AddTeamMemberDto, CreateTeamDto, GetSegmentsDto, GetTeamListDto, GetTeamMembersDto, TeamMemberRole, UpdateTeamDto, UserStatus } from "./dto/create-team.dto";
import { DeleteTeamMemberDto, UpdateTeamMemberDto, DeleteTeamDto } from "./dto/edit-team.dto";
import { EmailService } from "../email/email.service";
import { generateRandomPassword } from "@/common/custom/generate-password";
import bcrypt from "bcrypt";
import { ContactStatus, Prisma, TeamMemberStatus, TeamRole, YesNo } from "@prisma/client";
import { returnError } from "@/common/helpers/response-handler.helper";
import { prepareCommonQueryParams } from "@/common/helpers/request-handler.helper";
import { LoginUser } from "../auth/dto/login-user.dto";
import { RoleDTO } from "@/utils/RoleDTO";
import { ApiKeyUtils } from "@/utils/api-key-generator";
import { SearchUtils } from "@/utils/search.utils";
import { GetContactsDto } from "../contacts/dto/get-contacts.dto";
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly logger: PinoLogger,


  ) { }


  async createTeam(createTeamDto: CreateTeamDto, userDto: LoginUser) {
    // Check if current user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userDto.id },
    });

    if (!user) return returnError(400, 'User not found');

    const userRole = await this.prisma.role.findUnique({
      where: {
        id: user.roleId,
      },
      select: {
        name: true,
      }
    })

    console.log("userRole==============", userRole);

    // if (userRole.name !== "ADMIN") {
    //   throw new ForbiddenException('You do not have permission to create a team');
    // }

    const isExists = await this.prisma.team.findFirst({
      where: {
        name: createTeamDto.name,
        ownerId: userDto.id,
      }
    })

    if (isExists) {
      return returnError(400, 'Team name already exists');
    }

    const result = await this.prisma.team.create({
      data: {
        name: createTeamDto.name,
        description: createTeamDto.description,
        ownerId: userDto.id,
        agencyId: user.agencyId,
        status: "ACTIVE"
      },
    });

    return {
      status: 200,
      message: "Team created successfully.",
      data: result
    }
  }

  async updateTeam(userDto: LoginUser, dto: UpdateTeamDto) {

    // Check if current user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userDto.id },
    });

    if (!user) return returnError(400, 'User not found');

    const userRole = await this.prisma.role.findUnique({
      where: {
        id: user.roleId,
      },
      select: {
        name: true,
      }
    })

    // if (userRole.name !== "ADMIN") {
    //   throw new ForbiddenException('You do not have permission to create a team');
    // }

    const isExists = await this.prisma.team.findFirst({
      where: {
        name: dto.name,
        ownerId: userDto.id,
        NOT: {
          id: Number(dto.id)
        }
      }
    })

    if (isExists) {
      throw new Error('Team name already exists');
    }

    const result = await this.prisma.team.update({
      where: { id: Number(dto.id) },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    return {
      status: 200,
      message: "Team updated successfully.",
      data: result
    }
  }

  async getTeamMembers(user: LoginUser, query: GetTeamMembersDto) {
    const { page, perPage, sortOn, sortDirection, query: searchKey, needPagination = true, teamId } = prepareCommonQueryParams(query);

    // fetch the selected team
    const teamInfo = await this.prisma.team.findFirst({
      where: { id: teamId, ownerId: user.id },
      select: { id: true }
    });

    if (!teamInfo) return returnError(400, 'Team not found');

    // Build base where clause
    const baseWhere: Prisma.TeamMemberWhereInput = {
      teamId: teamInfo.id,
    };

    // Apply search using SearchUtils if searchKey is provided
    let where = baseWhere;

    if (searchKey) {
      // Create search conditions for the related member table
      const memberSearchConditions = SearchUtils.buildSearchQuery<any>(
        searchKey,
        {
          fields: ['email', 'userName'], // Search in member email and userName
          strategy: 'ALL', // Use 'ALL' for precise search results
          minTermLength: 2, // Ignore terms shorter than 2 characters
          maxTerms: 5, // Limit to 5 search terms
          caseSensitive: false
        }
      );

      // Apply the search conditions to the member relation
      where = {
        ...baseWhere,
        member: memberSearchConditions
      };
    }

    if (needPagination) {
      const skip = (page - 1) * perPage;
      const [members, totalCount] = await this.prisma.$transaction([
        this.prisma.teamMember.findMany({
          where,
          include: { member: true },
          skip,
          take: perPage,
          orderBy: sortOn ? { [sortOn]: sortDirection } : { id: "asc" },
        }),
        this.prisma.teamMember.count({
          where,
        }),
      ]);

      const totalPages = Math.ceil(totalCount / perPage);

      return {
        status: 200,
        message: "Team members fetched successfully.",
        data: members.map((tm) => ({
          id: tm.id,
          teamRole: tm.teamRole,
          status: tm.status,
          member: {
            id: tm.member.id,
            email: tm.member.email,
            userName: tm.member.userName,
            roleId: tm.member.roleId,
            profileUrl: tm.member.profileUrl,
            isMailVerified: tm.member.isMailVerified,
          },
        })),
        pagination: { page, perPage, totalPages, totalCount },
      };
    }

    // fetch all members if pagination not needed
    const members = await this.prisma.teamMember.findMany({
      where,
      include: { member: true },
      orderBy: sortOn ? { [sortOn]: sortDirection } : { id: "desc" },
    });

    return {
      status: 200,
      message: "Team members fetched successfully.",
      data: members.map((tm) => ({
        id: tm.id,
        teamRole: tm.teamRole,
        status: tm.status,
        member: {
          id: tm.member.id,
          email: tm.member.email,
          userName: tm.member.userName,
          roleId: tm.member.roleId,
          profileUrl: tm.member.profileUrl,
          isMailVerified: tm.member.isMailVerified,
        },
      })),
    };
  }

  private checkAdmin(user: LoginUser) {
    if (user.roleName !== RoleDTO.ADMIN_ROLE_NAME) {
      throw new ForbiddenException('Only ADMIN can manage team members');
    }
  }
  async updateTeamMember(user: LoginUser, dto: UpdateTeamMemberDto) {
    this.checkAdmin(user);

    const teamMember = await this.prisma.teamMember.findUnique({
      where: { id: Number(dto.id) },
      select: {
        id: true,
        teamId: true,
        memberId: true,
        teamRole: true,
      },
    });

    if (!teamMember) {
      return returnError(400, 'Team member not found');
    }

    let roleIdToUpdate: bigint | undefined;

    // If updating role to LEADER → reset all other leaders in the same team
    if (dto.teamRole === TeamRole.LEADER) {
      await this.prisma.teamMember.updateMany({
        where: {
          teamId: teamMember.teamId,
          teamRole: TeamRole.LEADER,
          NOT: { id: teamMember.id },
        },
        data: { teamRole: TeamRole.MEMBER },
      });

      const leaderRole = await this.prisma.role.findFirst({
        where: {
          agencyId: user.agencyId,
          name: RoleDTO.TEAM_LEADER_ROLE_NAME,
          status: 'ACTIVE',
        },
      });
      roleIdToUpdate = leaderRole?.id;
    }

    // Update TeamMember
    const updatedTeamMember = await this.prisma.teamMember.update({
      where: { id: Number(dto.id) },
      data: {
        teamRole: dto.teamRole,
      },
      select: {
        id: true,
        teamRole: true,
        member: {
          select: {
            id: true,
            userName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    // Update User name if provided
    let updatedUser = null;
    if (dto.name || roleIdToUpdate) {
      const updateData: any = {};
      if (dto.name) updateData.userName = dto.name;
      if (roleIdToUpdate) updateData.roleId = roleIdToUpdate;

      updatedUser = await this.prisma.user.update({
        where: { id: teamMember.memberId },
        data: updateData,
        select: { id: true, userName: true, email: true, status: true, roleId: true },
      });
    }

    return {
      status: 200,
      message: "Team member updated successfully.",
      data: {
        id: updatedTeamMember.id,
        teamRole: updatedTeamMember.teamRole,
        member: updatedUser || updatedTeamMember.member,
      },
    };
  }

  async deleteTeamMember(user: LoginUser, dto: DeleteTeamMemberDto) {
    this.checkAdmin(user);

    const teamMember = await this.prisma.teamMember.findUnique({
      where: { id: Number(dto.id) },
    });

    if (!teamMember) {
      return returnError(400, 'Team member not found');
    }

    await this.prisma.teamMember.delete({
      where: { id: Number(dto.id) },
    });

    await this.prisma.user.delete({
      where: { id: teamMember.memberId },
    })

    return {
      status: 200,
      message: "Team member deleted successfully."
    };
  }

  async addMemberUnderUser(user: LoginUser, dto: AddTeamMemberDto) {

    const existing = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
      },
    });

    if (existing) {
      throw new Error("User with this email already exists.");
    }

    const tempPassword = generateRandomPassword();
    console.log("Generated Password:=============", tempPassword);

    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    console.log("first hashedPassword:=============", hashedPassword);

    const role = await this.prisma.role.findFirst({
      where: {
        name: RoleDTO.MEMBER_ROLE_NAME,
      },
      select: {
        id: true,
        permissionMask: true
      }
    });
    console.log("role:=============", role);

    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword, // You can replace this with invite logic
        rawPassword: tempPassword,
        userName: dto.user_name,
        parentUserId: user.id, // Set the parentUserId to the user's ID]: user.id,
        roleId: role.id,
        phone: dto.phone,
        status: UserStatus.PENDING,
        isMailVerified: YesNo.YES,
        currentCredit: 0,
        timeZone: dto.timezone ?? "UTC",
        agencyId: user.agencyId,
        apiKey: ApiKeyUtils.generateApiKey({ prefix: 'sk_', length: 32 }),
        rolePermissionMask: role.permissionMask,
        addedPermissionMask: "0",
        removedPermissionMask: "0"
      }
    });

    console.log("newUser:=============", newUser);
    await this.emailService.sendEmail({
      to: dto.email,
      subject: 'Welcome to the Team!',
      body: `
        <p>Hello ${dto.user_name},</p>
        <p>Your login password is: <pre><strong>${tempPassword}</strong></pre></p>
        <p>
          <a href=${process.env.LOGIN_URL} target="_blank" style="display:inline-block;padding:10px 15px;background:#0052cc;color:white;text-decoration:none;border-radius:4px;">
            Log In to Your Account
          </a>
        </p>
        <br/>
        <p>Best regards,</p>
        <p>${process.env.COMPANY_NAME}</p> 
      `,

      user_id: user.id,
    });

    // If the new member is being added as LEADER → reset other leaders
    if (dto.role === TeamMemberRole.LEADER) {
      await this.prisma.teamMember.updateMany({
        where: {
          teamId: dto.teamId,
          teamRole: TeamRole.LEADER,
        },
        data: { teamRole: TeamRole.MEMBER },
      });
    }

    const teamMember = await this.prisma.teamMember.create({
      data: {
        agencyId: user.agencyId,
        teamId: dto.teamId,
        memberId: newUser.id,
        teamRole: dto.role === TeamMemberRole.LEADER ? TeamRole.LEADER : TeamRole.MEMBER,
        status: TeamMemberStatus.ACTIVE,
      },
    });
    console.log("teamMember:=============", teamMember);

    return {
      status: 201,
      message: "Team member added successfully.",
      data: newUser
    };
  }

  async getTeamList(user: LoginUser, query: GetTeamListDto) {
    const { page, perPage, sortOn, sortDirection, query: searchKey, needPagination = true } = prepareCommonQueryParams(query);

    // Build base where clause
    const baseWhere: Prisma.TeamWhereInput = {
      ownerId: user.id,
    };

    // Apply search using SearchUtils if searchKey is provided
    const where = searchKey
      ? SearchUtils.applySearch<Prisma.TeamWhereInput>(
        baseWhere,
        searchKey,
        {
          fields: ['name', 'description'], // Search in both name and description
          strategy: 'ALL', // Use 'ALL' for precise search results
          minTermLength: 2, // Ignore terms shorter than 2 characters
          maxTerms: 5, // Limit to 5 search terms
          caseSensitive: false
        }
      )
      : baseWhere;

    // if pagination is needed
    if (needPagination) {
      const skip = (page - 1) * perPage;
      const [teams, totalCount] = await this.prisma.$transaction([
        this.prisma.team.findMany({
          where,
          skip,
          take: perPage,
          orderBy: sortOn
            ? { [sortOn]: sortDirection }
            : [
              { updatedAt: "desc" },
              { createdAt: "desc" },
            ],
        }),
        this.prisma.team.count({
          where,
        }),
      ]);

      const totalPages = Math.ceil(totalCount / perPage);

      return {
        status: 200,
        message: "Team list fetched successfully.",
        data: teams.map((team) => ({
          id: team.id,
          name: team.name,
          description: team.description,
          status: team.status,
          ownerId: team.ownerId,
          agencyId: team.agencyId,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        })),
        pagination: { page, perPage, totalPages, totalCount },
      };
    }

    // if no pagination, fetch all teams
    const teams = await this.prisma.team.findMany({
      where,
      orderBy: sortOn
        ? { [sortOn]: sortDirection }
        : [
          { updatedAt: "desc" },
          { createdAt: "desc" },
        ],
    });

    return {
      status: 200,
      message: "Team list fetched successfully.",
      data: teams.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        status: team.status,
        ownerId: team.ownerId,
        agencyId: team.agencyId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      })),
    };
  }


  async deleteTeam(user: LoginUser, query: DeleteTeamDto) {

    const teamId = query.id;
    const userId = user.parentUserId ?? user.id;

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        ownerId: true
      }
    });

    if (!team || team.ownerId !== userId) {
      return returnError(400, 'Team not found or unauthorized');
    }

    await this.prisma.team.delete({
      where: { id: teamId },
    });

    return {
      status: 200,
      message: "Team deleted successfully.",
    };

  }

  // get those contact list which is not in contactAssignment to assign to team member
  async getContactList(user: LoginUser, dto: GetContactsDto) {
    const {
      page = 1, // Default to 1 if undefined
      limit = 10, // Default to 10 if undefined
      segmentId,
      tagId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = dto;

    // Validate and parse pagination parameters
    const parsedPage = Math.max(1, isNaN(Number(page)) ? 1 : Number(page)); // Ensure page is a valid number
    const parsedLimit = Math.min(Math.max(1, isNaN(Number(limit)) ? 10 : Number(limit)), 100); // Ensure limit is a valid number

    // Log pagination parameters for debugging
    this.logger.debug(`Pagination: page=${page}, limit=${limit}, parsedPage=${parsedPage}, parsedLimit=${parsedLimit}, skip=${(parsedPage - 1) * parsedLimit}`);

    // Filter by tag
    let tagContactIds: bigint[] = [];
    if (tagId) {
      const tagContacts = await this.prisma.contactTag.findMany({
        where: { tagId: BigInt(tagId) },
        select: { contactId: true },
      });
      tagContactIds = tagContacts.map(tc => tc.contactId);
    }

    let contactIds: bigint[] = [];
    // Get all contactIds by segment id
    if (segmentId) {
      const segmentContacts = await this.prisma.segmentContact.findMany({
        where: { segmentId: BigInt(segmentId) },
        select: { contactId: true },
      });
      contactIds = segmentContacts.map(sc => sc.contactId);
    }

    // Get contactIds from contactAssignment to exclude
    const assignedContactIds = await this.prisma.contactAssignment.findMany({
      select: { contactId: true },
    });
    const excludedContactIds = assignedContactIds.map(ac => ac.contactId);

    // Define allowed sort fields and order to prevent invalid sorting
    const validSortFields = ['firstName', 'lastName', 'createdAt', 'updatedAt'];
    const validSortOrders = ['asc', 'desc'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'asc';

    // Build the base where clause
    const baseWhere: Prisma.ContactWhereInput = {
      userId: user.parentUserId ?? user.id,
      id: {
        notIn: excludedContactIds // Exclude contacts in contactAssignment
      }
    };

    // Prepare tag and segment filters
    let idFilter: { in: bigint[] } | undefined;

    // Apply tag filter
    if (tagId && tagContactIds.length > 0) {
      idFilter = { in: tagContactIds };
    }

    // Apply segment filter
    if (segmentId && contactIds.length > 0) {
      if (idFilter) {
        // If both tag and segment are provided, find intersection
        const tagAndSegmentIds = tagContactIds.filter(id => contactIds.includes(id));
        idFilter = { in: tagAndSegmentIds };
      } else {
        idFilter = { in: contactIds };
      }
    }

    // Apply the ID filter if it exists
    if (idFilter) {
      baseWhere.id = {
        notIn: excludedContactIds,
        in: idFilter.in
      };
    }

    // Status validation
    const validStatuses = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'];
    if (status && !validStatuses.includes(status)) {
      return {
        contacts: [],
        total: 0,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: 0,
        message: `Invalid status value: ${status}. Expected one of ${validStatuses.join(', ')}.`,
      };
    }

    if (status) baseWhere.status = status as ContactStatus;

    // Apply search using SearchUtils
    const searchTerms: string[] = [];
    const searchFields: (keyof Prisma.ContactWhereInput)[] = [];

    // Build the search query
    let where = baseWhere;

    // If we have search terms, apply search
    if (searchTerms.length > 0) {
      // Create a search string by joining all terms
      const searchString = searchTerms.join(' ');

      // Apply search using SearchUtils
      where = SearchUtils.applySearch<Prisma.ContactWhereInput>(
        baseWhere,
        searchString,
        {
          fields: searchFields,
          strategy: 'ALL',
          minTermLength: 1,
          maxTerms: 10,
          caseSensitive: false
        }
      );
    }

    try {
      const [contacts, total] = await Promise.all([
        this.prisma.contact.findMany({
          where,
          take: parsedLimit,
          skip: (parsedPage - 1) * parsedLimit,
          orderBy: { [finalSortBy]: finalSortOrder },
        }),
        this.prisma.contact.count({ where }),
      ]);

      // Log results for debugging
      this.logger.debug(`Pagination Results: total=${total}, contacts=${contacts.length}, totalPages=${Math.ceil(total / parsedLimit)}`);

      return {
        contacts,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        message: contacts.length === 0 ? 'No contacts found for the given criteria.' : undefined,
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma error: ${error.message}`, error.stack);
        return {
          contacts: [],
          total: 0,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: 0,
          message: `Invalid query parameters: ${error.message}`,
        };
      }
      // Handle unexpected errors
      this.logger.error(`Failed to fetch contacts: ${error.message}`, error.stack);
      return {
        contacts: [],
        total: 0,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: 0,
        message: 'An unexpected error occurred while fetching contacts.',
      };
    }
  }


  // getSegmentList without those contacts in the segment those are already assigned to team member
  async getSegmentList(user: LoginUser, dto: GetSegmentsDto) {
    try {

      const { id: userId } = user

      const { userId: memberId, page, limit, sortBy, sortOrder, name } = dto;
      const parsedPage = page || 1;
      const parsedLimit = limit || 10;
      const finalSortBy = sortBy || 'createdAt';
      const finalSortOrder = sortOrder || 'desc';

      // console.log("dto on service", dto);

      // Build the where clause
      const where: Prisma.SegmentWhereInput = {
        userId: BigInt(userId),
      };

      // Build OR conditions for search filters
      const orConditions: Prisma.SegmentWhereInput[] = [];
      if (name?.trim()) {
        orConditions.push({ name: { contains: name.trim() } });
      }

      if (orConditions.length > 0) {
        where.OR = orConditions;
      }

      const existingContactIds = await this.prisma.contactAssignment.findMany({
        where: { userId: memberId },
        select: { contactId: true },
      });

      const excludedContactIds = existingContactIds.map((assignment) => assignment.contactId);

      // console.log('excludedContactIds:', excludedContactIds);

      const [segments, total] = await Promise.all([
        this.prisma.segment.findMany({
          where,
          include: {
            segmentContact: {
              select: { contactId: true },
              where: {
                contactId: {
                  notIn: excludedContactIds,
                },
              },
            },
          },
          take: parsedLimit,
          skip: (parsedPage - 1) * parsedLimit,
          orderBy: { [finalSortBy]: finalSortOrder },
        }),
        this.prisma.segment.count({ where }), // Use the same where clause
      ]);

      // console.log("segments on service", segments);

      return {
        segments: segments.map(segment => ({
          id: segment.id.toString(),
          name: segment.name,
          filters: segment.filters,
          contactIds: segment.segmentContact.map(sc => sc.contactId.toString()),
        })),
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        message: segments.length === 0 ? 'No segments found for the given criteria.' : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch segments: ${error.message}`, error.stack);
      return {
        segments: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        message: 'An unexpected error occurred while fetching segments.',
      };
    }
  }
}
