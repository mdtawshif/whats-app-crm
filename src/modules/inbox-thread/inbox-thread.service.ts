import { Injectable } from '@nestjs/common'
import { PrismaService } from 'nestjs-prisma'
import { PinoLogger } from 'nestjs-pino'
import {
  CreateInboxThreadDto,
  UpdateInboxThreadDto,
  InboxThreadQueryDto
} from './dto'
import { InboxInOut, Prisma } from '@prisma/client'
import { formatThread, } from '@/utils/inbox-threads.utils'
import type { LoginUser } from '../auth/dto/login-user.dto'
import { normalizeThreadNumbers } from '@/utils/phone-numbers/format-phone-number'
import type { CheckIsInboxThreadExistsDto } from './dto/check-inbox-thread.dto'
import { CountResult, InboxThreadQueryType, InboxThreadResponse, type FormattedInboxThread, type RawInboxThread } from 'src/types/inbox-threads'

import { inboxThreadBaseInclude } from '@/utils/prisma/includes/inbox-thread.includes'
import { RoleDTO } from '@/utils/RoleDTO'
import { PaginationInfo } from '@/common/helpers/pagination.info'

@Injectable()
export class InboxThreadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(InboxThreadService.name)
  }


  /** --------------------------------------------------------------
     *  GET INBOX THREADS – ROLE + TYPE aware
     *  --------------------------------------------------------------
     *  • baseUserId = parentUserId ?? own id
     *  • LEFT JOIN only for type = unassigned
     *  • Admins never see unassigned → empty result
     *  --------------------------------------------------------------
     */
  async getInboxThreads(user: LoginUser, query: InboxThreadQueryDto) {
    this.logger.info(
      'Fetching inbox threads → %o | user: %o',
      query,
      { id: user.id, role: user.roleName, parentId: user.parentUserId },
    );

    // Normalize query params
    const {
      query: search,
      limit = 20,
      page = 1,
      sortBy = 'lastCommunication',
      sortOrder = 'desc',
      type = InboxThreadQueryType.ALL,
    } = query;
    const skip = (page - 1) * limit;

    /*
    // Build role-based type condition
    const typeCondition = this.buildTypeCondition(user, type);

    // Build search clause
    const searchClause = this.buildSearchClause(search);

    // Build order by clause
    const orderByClause = this.buildOrderByClause(sortBy, sortOrder);

    // Execute queries
    const [threads, count] = await this.executeQueries(
      { user, typeCondition, searchClause, orderByClause, limit, skip }
    );


    // Format threads required frontend
    const formatted = this.formatInboxThreads(threads);
    */

    const finalQuery = await this.buildQuery(user, query);
    console.log("dataSelectQuery: "+finalQuery.dataSelectQuery);
    console.log("countQuery: "+finalQuery.countQuery);
    
    try{
    const [data, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<InboxThreadResponse[]>(finalQuery.dataSelectQuery),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(finalQuery.countQuery),
    ]);

    const total = Number(countResult[0]?.total ?? 0n);
    // const pagination = new PaginationInfo(Number(countResult[0]?.total || 0), page, limit);
    console.log("InboxThreadResponse", data);
    console.log("totalCount", countResult[0]?.total || 0);
    return {
      data: data,
      total: countResult[0]?.total || 0,
      page,
      limit,
    };
    }catch(error){
      console.log(error);
    }
  }

  private async buildQuery(user: LoginUser, request: InboxThreadQueryDto){
    let page = request.page ? request.page: 1;
    let pageLimit = request.limit ? request.limit: 20;
    const offset = (page - 1) * pageLimit;

    const userId = user.parentUserId ?? user.id;
    let dataSelectQuery = '';
    let searchQuery = '';
    let countQuery = 'SELECT COUNT(*) AS total ';
    let orderByQuery = ' ORDER BY lastCommunication ';
    orderByQuery+= request.sortOrder ? `${request.sortOrder}` : 'desc';
    let offsetQuery = ` LIMIT ${pageLimit} OFFSET ${offset}`;
    
    if(request.query){
        searchQuery = ` AND (c.first_name like '%${request.query}%' OR c.last_name like '%${request.query}%' OR c.email like '%${request.query}% ')`
    }
    
    let whereClause = `WHERE it.user_id = ${userId} `;

    let fromQuery = 'FROM inbox_threads it ';
        fromQuery+='INNER JOIN contacts c ON c.id = it.contact_id ';
        fromQuery+='LEFT JOIN contact_assignments ca ON ca.contact_id = it.contact_id ';

    let selectQuery = `SELECT it.id, it.agency_id as agencyId, it.user_id as userId, it.contact_id as contactId, it.message_content as messageContent, it.content_type as contentType, it.in_out as 'inOut', it.from, it.to, it.status, it.last_communication as lastCommunication`;
        selectQuery+=',c.first_name as firstName,c.last_name as lastName, c.number as phoneNumber, c.email as contactEmail '
    
    if(request.type === InboxThreadQueryType.UNASSIGNED){
      whereClause+='AND ca.contact_id IS NULL ';
      whereClause+=searchQuery;
      dataSelectQuery = selectQuery + fromQuery + whereClause + orderByQuery + offsetQuery + searchQuery;
      countQuery+= fromQuery + whereClause + searchQuery;
      return{dataSelectQuery, countQuery};
    }

    switch(user.roleName){
      case RoleDTO.ADMIN_ROLE_NAME:{
          if(request.type === InboxThreadQueryType.ALL){
            selectQuery+=`, u.email as userEmail, u.user_name as userName `
            fromQuery+= 'LEFT JOIN users u ON u.id = it.created_by '
            whereClause+='AND ca.contact_id IS NOT NULL ';
          }
        break;
      }
      case RoleDTO.TEAM_LEADER_ROLE_NAME:{
        if(request.type === InboxThreadQueryType.MINE){
          whereClause+=`AND it.created_by = ${user.id}`
        }else if(request.type === InboxThreadQueryType.ALL){
            const teamId = await this.findTeamId(user);
            selectQuery+=`, u.email as userEmail, u.user_name as userName `
            fromQuery+= 'LEFT JOIN users u ON u.id = it.created_by '
            fromQuery+='LEFT JOIN team_members tm on tm.member_id = it.created_by ';
            whereClause+=`AND tm.team_id = ${teamId} `;
        }
        break;
      }
      case RoleDTO.MEMBER_ROLE_NAME:{
        if(request.type === InboxThreadQueryType.MINE){
          whereClause+=`AND it.created_by = ${user.id} `
        }
        break;
      }
    }

    dataSelectQuery = selectQuery + fromQuery + whereClause + searchQuery + orderByQuery + offsetQuery;
    countQuery+=fromQuery + whereClause + searchQuery;

    return {
      dataSelectQuery,
      countQuery
    }
  }

  private async findTeamId(user:LoginUser){
    const teamMember = await this.prisma.teamMember.findFirst({
      where:{
        memberId: user.id
      }
    })
    return teamMember ? teamMember.id : null;
  }


  /**
   * Builds type condition based on user role and query type
   * Each role has specific access rules:
   * - Admin: ALL (no filter), UNASSIGNED (no assignments), MINE (disabled)
   * - Team Leader: ALL (team assignments), MINE (direct assignments), UNASSIGNED (no assignments)
   * - Member: MINE (direct assignments), UNASSIGNED (no assignments), ALL (disabled)
   */
  private buildTypeCondition(user: LoginUser, type: InboxThreadQueryType): Prisma.Sql {
    switch (user.roleName) {
      // ====================== ADMIN ROLE ======================
      // Admins see all threads or unassigned threads only
      case RoleDTO.ADMIN_ROLE_NAME:
        switch (type) {
          case InboxThreadQueryType.ALL:
            return Prisma.empty; // No filter - see all threads

          case InboxThreadQueryType.MINE:
            return Prisma.sql`AND FALSE`; // Admins don't have "mine" filter

          case InboxThreadQueryType.UNASSIGNED:
            // Threads not assigned to any team leader or member
            return Prisma.sql`
            AND NOT EXISTS (
              SELECT 1 FROM contact_assignments ca 
              WHERE ca.contact_id = it.contact_id 
                AND ca.agency_id = ${user.agencyId}
            )
          `;

          default:
            return Prisma.sql`AND FALSE`;
        }

      // ====================== TEAM LEADER ROLE ======================
      // Team Leaders see team assignments, direct assignments, or unassigned threads
      case RoleDTO.TEAM_LEADER_ROLE_NAME:
        switch (type) {
          case InboxThreadQueryType.ALL:
            // Threads assigned to team leader OR any team member
            return Prisma.sql`
            AND EXISTS (
              SELECT 1 FROM contact_assignments ca 
              WHERE ca.contact_id = it.contact_id 
                AND ca.agency_id = ${user.agencyId}
                AND ca.assigned_to IN (
                  SELECT id FROM users 
                  WHERE id = ${user.id}
                )
            )
          `;

          case InboxThreadQueryType.MINE:
            // Threads assigned directly to team leader
            return Prisma.sql`
            AND EXISTS (
              SELECT 1 FROM contact_assignments ca 
              WHERE ca.contact_id = it.contact_id 
                AND ca.agency_id = ${user.agencyId}
                AND ca.assigned_to = ${user.id}
            )
          `;

          case InboxThreadQueryType.UNASSIGNED:
            // Threads not assigned to any team leader or member
            return Prisma.sql`
            AND NOT EXISTS (
              SELECT 1 FROM contact_assignments ca 
              WHERE ca.contact_id = it.contact_id 
                AND ca.agency_id = ${user.agencyId}
            )
          `;

          default:
            return Prisma.sql`AND FALSE`;
        }

      // ====================== MEMBER ROLE ======================
      // Members see direct assignments or unassigned threads only
      case RoleDTO.MEMBER_ROLE_NAME:
        switch (type) {
          case InboxThreadQueryType.ALL:
            return Prisma.sql`AND FALSE`; // Members don't have "all" filter

          case InboxThreadQueryType.MINE:
            // Threads assigned to member
            return Prisma.sql`
            AND EXISTS (
              SELECT 1 FROM contact_assignments ca 
              WHERE ca.contact_id = it.contact_id 
                AND ca.agency_id = ${user.agencyId}
                AND ca.assigned_to = ${user.id}
            )
          `;

          case InboxThreadQueryType.UNASSIGNED:
            // Threads not assigned to any team leader or member
            return Prisma.sql`
            AND NOT EXISTS (
              SELECT 1 FROM contact_assignments ca 
              WHERE ca.contact_id = it.contact_id 
                AND ca.agency_id = ${user.agencyId}
            )
          `;

          default:
            return Prisma.sql`AND FALSE`;
        }

      // ====================== UNKNOWN ROLE ======================
      default:
        return Prisma.sql`AND FALSE`; // Unknown role - no threads
    }
  }

  /**
   * Builds search clause for contact filtering
   * Searches in first name, last name, and email fields
   */
  private buildSearchClause(search: string): Prisma.Sql {
    if (!search) return Prisma.empty;

    return Prisma.sql`
    AND (
      c.first_name LIKE ${'%' + search + '%'}
      OR c.last_name  LIKE ${'%' + search + '%'}
      OR c.email      LIKE ${'%' + search + '%'}
    )
  `;
  }

  /**
   * Builds ORDER BY clause for sorting
   * Supports sorting by lastCommunication or createdAt
   */
  private buildOrderByClause(sortBy: string, sortOrder: string): Prisma.Sql {
    const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    return Prisma.sql`
    ORDER BY
      CASE 
        WHEN ${sortBy} = 'lastCommunication' THEN it.last_communication
      END ${direction}
  `;
  }

  /**
   * Executes list and count queries
   * Returns both thread data and total count
   */
  private async executeQueries(
    { user, typeCondition, searchClause, orderByClause, limit, skip }
      : {
        user: LoginUser,
        typeCondition: Prisma.Sql,
        searchClause: Prisma.Sql,
        orderByClause: Prisma.Sql,
        limit: number,
        skip: number
      }
  ): Promise<[RawInboxThread[], number]> {
    // List query
    // Inside executeQueries → listQuery
    const listQuery = Prisma.sql`
  SELECT
    it.id,
    it.agency_id,
    it.user_id,
    it.contact_id,
    it.message_content,
    it.content_type,
    it.in_out,
    it.from,
    it.to,
    it.status,
    it.last_communication,

    c.first_name   AS contact_first_name,
    c.last_name    AS contact_last_name,
    c.number       AS contact_number,
    c.status       AS contact_status,

    -- Assigned user info
    ca.assigned_to AS assigned_user_id,
    au.user_name   AS assigned_user_name,
    au.email       AS assigned_user_email

    -- end assigned user info

  FROM inbox_threads it
  INNER JOIN contacts c ON it.contact_id = c.id

  -- LEFT JOIN to get assignment (if exists)
  LEFT JOIN contact_assignments ca 
    ON it.contact_id = ca.contact_id 
   AND ca.agency_id = ${user.agencyId}
  LEFT JOIN users au 
    ON ca.assigned_to = au.id
    -- End getting assignment user

  WHERE it.agency_id = ${user.agencyId}
    ${typeCondition}
    ${searchClause}

  ${orderByClause}
  LIMIT ${limit} OFFSET ${skip}
`;

    // Count query
    const countQuery = Prisma.sql`
    SELECT COUNT(*) AS total
    FROM inbox_threads it
    INNER JOIN contacts c ON it.contact_id = c.id

    WHERE it.agency_id = ${user.agencyId}
      ${typeCondition}
      ${searchClause}
  `;

    // Log queries
    this.logger.debug('LIST SQL:\n' + listQuery.sql);
    this.logger.debug('LIST PARAMS:\n' + JSON.stringify(listQuery.values));
    this.logger.debug('COUNT SQL:\n' + countQuery.sql);
    this.logger.debug('COUNT PARAMS:\n' + JSON.stringify(countQuery.values));

    // Execute queries
    const [threads, countResult] = await Promise.all([
      this.prisma.$queryRaw<RawInboxThread[]>(listQuery),
      this.prisma.$queryRaw<{ total: bigint }[]>(countQuery),
    ]);

    return [threads, Number(countResult[0].total)];
  }

  private formatInboxThreads(threads: RawInboxThread[]): FormattedInboxThread[] {
    return threads.map((t) => {
      const isSentByAgent = t.in_out === InboxInOut.OUT;

      return {
        id: t.id,
        agencyId: t.agency_id,
        userId: t.user_id,
        contactId: t.contact_id,
        inOut: t.in_out,
        messageContent: t.message_content,
        contentType: t.content_type,
        from: t.from,
        to: t.to,
        status: t.status,
        lastCommunication: t.last_communication,

        contact: {
          id: t.contact_id,
          name: `${t.contact_first_name} ${t.contact_last_name}`,
          number: t.contact_number,
          status: t.contact_status,
        },

        // Direct assignment info (no nested transform)
        isSentByAgent,
        hasAssigned: !!t.assigned_user_id,
        assignedUser: t.assigned_user_id
          ? {
            id: Number(t.assigned_user_id),
            name: t.assigned_user_name || "Unknown",
            email: t.assigned_user_email || "",
          }
          : undefined,

      } as unknown as FormattedInboxThread;
    });
  }



  async getInboxThread(id: string) {
    this.logger.info('Fetching inbox thread with ID: %s', id)
    const thread = await this.prisma.inboxThread.findUniqueOrThrow({
      where: { id: BigInt(id) },
      include: {
        user: {
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            userName: true,
            email: true,
            profileUrl: true
          }
        },
        agency: true,
        contact: true
      }
    })

    return thread
  }

  // Check inbox thread by from, to
  async checkIsInboxThreadExists(
    user: LoginUser,
    dto: CheckIsInboxThreadExistsDto
  ) {
    const { from, to, contactId } = dto
    this.logger.info(
      'Checking inbox thread exists with from: %s, to: %s, contactId: %s',
      from,
      to,
      contactId
    )

    const { normalizedFrom, normalizedTo } = normalizeThreadNumbers(from, to)

    // Define the include with Prisma's validator for proper type inference
    // const includeBuilder = inboxThreadBaseInclude

    // First, try to find an existing thread with matching from/to numbers
    const existingExactMatch = await this.prisma.inboxThread.findFirst({
      where: {
        agencyId: user.agencyId,
        userId: user.id,
        contactId: BigInt(contactId),
        OR: [
          { from: normalizedFrom, to: normalizedTo },
          { from: normalizedTo, to: normalizedFrom }
        ]
      },
      include: inboxThreadBaseInclude
    })

    if (existingExactMatch) {
      return formatThread(existingExactMatch)
    }

    // Otherwise, check if this contact has *any other* thread (different numbers)
    const existingSameContactDifferentNumber =
      await this.prisma.inboxThread.findFirst({
        where: {
          agencyId: user.agencyId,
          userId: user.id,
          contactId: BigInt(contactId),
          NOT: {
            OR: [
              { from: normalizedFrom, to: normalizedTo },
              { from: normalizedTo, to: normalizedFrom }
            ]
          }
        },
        include: inboxThreadBaseInclude
      })

    if (existingSameContactDifferentNumber) {
      const formatted = formatThread(existingSameContactDifferentNumber)
      return {
        ...formatted,
        hasExistingThreadWithAnotherNumber: true
      }
    }

    return null
  }

  async createInboxThread(dto: CreateInboxThreadDto) {
    this.logger.info('Creating or updating inbox thread with data: %o', dto)

    const agencyId = BigInt(dto.agencyId)
    const userId = BigInt(dto.userId)
    const contactId = BigInt(dto.contactId)

    // Common data for create or update
    const commonData: Prisma.InboxThreadUpdateInput = {
      contentType: dto.contentType,
      inOut: dto.inOut,
      messageContent: dto.messageContent,
      mediaUrl: dto.mediaUrl,
      status: dto.status,
      isRead: 'UNREAD', // Reset to UNREAD for new message; adjust if your enum differs
      lastCommunication: new Date()
    }

    // Normalize phone numbers
    const { normalizedFrom, normalizedTo } = normalizeThreadNumbers(
      dto.from,
      dto.to
    )
    // Check for existing thread using OR condition for from/to
    const existing = await this.prisma.inboxThread.findFirst({
      where: {
        agencyId,
        userId,
        contactId,
        OR: [
          { from: normalizedFrom, to: normalizedTo },
          { from: normalizedTo, to: normalizedFrom }
        ]
      }
    })

    if (existing) {
      this.logger.info(
        'Existing thread found, updating ID: %s',
        existing.id.toString()
      )
      return this.prisma.inboxThread.update({
        where: { id: existing.id },
        data: commonData,
        include: {
          user: {
            select: {
              id: true,
              parentUserId: true,
              agencyId: true,
              userName: true,
              email: true,
              profileUrl: true
            }
          },
          agency: true,
          contact: true
        }
      })
    } else {
      const userData = await this.prisma.user.findUnique({
        where: { id: userId }
      })

      this.logger.info('No existing thread, creating new one')

      return this.prisma.inboxThread.create({
        data: {
          agencyId: BigInt(userData.agencyId),
          userId: BigInt(userData.parentUserId ?? userData.id),
          createdBy: BigInt(userData.id),
          contactId: BigInt(contactId),
          from: normalizedFrom,
          to: normalizedTo,
          ...commonData
        } as Prisma.InboxThreadUncheckedCreateInput, //  cast to unchecked inpu
        include: {
          user: {
            select: {
              id: true,
              parentUserId: true,
              agencyId: true,
              userName: true,
              email: true,
              profileUrl: true
            }
          },
          agency: true,
          contact: true
        }
      })
    }
  }

  async updateInboxThread(id: string, dto: UpdateInboxThreadDto) {
    this.logger.info('Updating inbox thread ID: %s with data: %o', id, dto)

    // Update the thread
    return this.prisma.inboxThread.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto as Prisma.InboxThreadUpdateInput)
      },
      include: {
        user: {
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            userName: true,
            email: true,
            profileUrl: true
          }
        },
        agency: true,
        contact: true
      }
    })
  }

  async deleteInboxThread(agencyId: bigint, id: string) {
    this.logger.info('Deleting inbox thread ID: %s', id)
    console.log({
      agencyId
    })

    const thread = await this.prisma.inboxThread.findUniqueOrThrow({
      where: { id: BigInt(id), agencyId: BigInt(agencyId) },
      include: {
        user: {
          select: {
            id: true,
            parentUserId: true,
            agencyId: true,
            userName: true,
            email: true,
            profileUrl: true
          }
        },
        agency: true,
        contact: true
      }
    })

    //remove all conversation messages
    await this.prisma.conversation.deleteMany({
      where: {
        agencyId: thread.agencyId,
        contactId: thread.contactId
      }
    })
    await this.prisma.inboxThread.delete({
      where: { id: BigInt(id), agencyId: BigInt(agencyId) }
    })

    return { id: thread.id }
  }
}
