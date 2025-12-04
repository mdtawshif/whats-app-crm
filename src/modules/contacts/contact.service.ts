import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Prisma, ContactStatus, NumberStatus, TeamRole, TriggerQueueStatus, type Contact, ActivityCategory, ActivityAction, WaNumberStatus, } from '@prisma/client';
import { CreateContactDto, UpdateContactDto, BulkCreateContactDto, GetContactsDto, GetContactQueueListDto, GetMemberContactsDto, GetContactQueueListForFilterDto } from './dto/index.dto';
import { PrismaService } from 'nestjs-prisma';
import { PinoLogger } from 'nestjs-pino';
import { AssignTagMultipleDto, AssignTagSingleDto, RemoveTagDto } from './dto/tag-assign.dto';
import { returnError } from '@/common/helpers/response-handler.helper';
import { AssignContactsDto, RemoveContactAssignmentsDto, ContactListItemDto, ContactListParamDto, GetAssignedWhatsAppNumbersDto, AssignWaAccountsToMemberDto } from './dto/assign-contact.dto';
import { LoginUser } from '../auth/dto/login-user.dto';

import { RoleDTO } from '@/utils/RoleDTO';
import { prepareCommonQueryParams } from '@/common/helpers/request-handler.helper';
import { SearchUtils } from '@/utils/search.utils';

import { PaginationMetaDto } from '../../common/dto/api-list-response.dto';
import _ from 'lodash';
import { parseBirthAnniversaryDate } from '@/utils/formatDate';
import { ContactSummary } from './dto/get-contacts.dto';
import { ApiViewResponseDto } from '../../common/dto/api-view-response.dto';
import { EventKeys } from '../../types/triggers/index';
import { TriggerEventManager } from '../trigger/services/trigger-event-manager/trigger-event-manager.service';
import { getChangedFields, getContactDisplayName } from '@/utils/contact';
import { TRIGGER_EVENT_CONTACT_ACTIONS, TRIGGER_FILTER_FIELDS } from '../trigger/constants/trigger.constant';
import { userSelect } from '@/utils/prisma/selects/custom.select';
import { createActivity } from '@/common/helpers/activity-log.helper';
import { BasePaginationDto } from '@/common/dto/base-pagination.dto';
@Injectable()
export class ContactService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggerEventManager: TriggerEventManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ContactService.name);
  }


  async getContactSummary(
    user: LoginUser,
  ): Promise<ApiViewResponseDto<ContactSummary>> {

    // Example Prisma (adjust if using TypeORM or raw SQL)
    const [totalContacts, activeChats, todayContacts] = await Promise.all([
      this.prisma.contact.count({ where: { userId: user.id } }),
      this.prisma.inboxThread.count({
        where: {
          userId: user.parentUserId ?? user.id,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.contact.count({
        where: {
          userId: user.parentUserId ?? user.id,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const responseRate = 0;

    const summary: ContactSummary = {
      totalContacts,
      activeChats,
      todayContacts,
      responseRate,
    };

    return {
      statusCode: 200,
      message: 'Contact summary retrieved successfully',
      data: summary,
    };

  }

  //getContactById
  async getContactById(id: bigint) {
    return this.prisma.contact.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        firstName: true,
        lastName: true,
        email: true,
      }
    });
  }



  async getContacts(user: LoginUser, query: ContactListParamDto) {
    try {
      const {
        page = 1,
        perPage = 10,
        sortOn = 'createdAt',
        sortDirection = 'desc',
        query: q,
        needPagination = false,
      } = query ?? {};

      const isMember = user.roleName === RoleDTO.MEMBER_ROLE_NAME;

      // Base where conditions without search
      const baseWhere: Prisma.ContactWhereInput = {
        userId: user.parentUserId ?? user.id, // User or their parent (for members)
        ...(isMember
          ? {
            // Only contacts assigned to this user
            ContactAssignment: { some: { userId: BigInt(user.id) } },
          }
          : {
            // Non-members: no extra restriction (agency-scoped already)
          }),
      };

      // Apply search if provided using SearchUtils
      const where = q
        ? SearchUtils.applySearch<Prisma.ContactWhereInput>(
          baseWhere,
          q,
          {
            fields: ['number', 'firstName', 'lastName', 'email'],
            strategy: 'ALL', // All terms must be present (balanced precision)
            minTermLength: 2,
            maxTerms: 5,
          }
        )
        : baseWhere;

      //  allow-list sort fields
      const allowedSortFields = new Set<keyof Prisma.ContactOrderByWithRelationInput>([
        'id',
        'number',
        'firstName',
        'lastName',
        'email',
        'createdAt',
        'updatedAt',
      ]);
      const sortField = allowedSortFields.has(sortOn as any) ? (sortOn as any) : ('id' as const);
      const orderBy: Prisma.ContactOrderByWithRelationInput = {
        [sortField]: sortDirection === 'asc' ? 'asc' : 'desc',
      };

      const baseFindArgs: Prisma.ContactFindManyArgs = {
        where,
        select: { id: true, number: true, firstName: true, lastName: true, email: true },
        orderBy,
      };

      if (needPagination) {
        const safePerPage = Math.max(1, Math.min(100, Number(perPage)));
        const safePage = Math.max(1, Number(page));
        const skip = (safePage - 1) * safePerPage;

        const [rows, total] = await this.prisma.$transaction([
          this.prisma.contact.findMany({ ...baseFindArgs, skip, take: safePerPage }),
          this.prisma.contact.count({ where }),
        ]);

        const data: ContactListItemDto[] = rows.map((r) => ({
          id: Number(r.id),
          number: r.number,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
        }));

        const totalPages = Math.max(1, Math.ceil(total / safePerPage));
        const pagination: PaginationMetaDto = {
          total,
          perPage: safePerPage,
          currentPage: safePage,
          totalPages,
          nextPage: safePage < totalPages ? safePage + 1 : undefined,
          prevPage: safePage > 1 ? safePage - 1 : undefined,
        };

        return {
          statusCode: 200,
          message: 'Contacts retrieved successfully.',
          data,
          pagination,
        };
      }

      // No pagination requested
      const rows = await this.prisma.contact.findMany(baseFindArgs);
      const data: ContactListItemDto[] = rows.map((r) => ({
        id: Number(r.id),
        number: r.number,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
      }));

      return {
        statusCode: 200,
        message: 'Contacts retrieved successfully.',
        data,
      };
    } catch (err) {
      console.error('getContacts error:', err);
      return {
        statusCode: 500,
        message: 'An error occurred while fetching contacts.',
        data: [],
      };
    }
  }

  async createSingleContact(
    user: LoginUser,
    dto: CreateContactDto
  ) {
    const source = await this.prisma.contactSource.findFirst({
      where: { name: 'MANUAL' },
    });
    if (!source) {
      throw new BadRequestException('Source "MANUAL" not found');
    }
    dto.sourceId = BigInt(source.id);

    // Check for duplicate
    const existingContact = await this.prisma.contact.findFirst({
      where: { number: dto.number, agencyId: user.agencyId, userId: user.parentUserId },
    });
    if (existingContact) {
      throw new BadRequestException(
        'Contact with this number already exists for the agency',
      );
    }

    // Build data with conditional spreads
    const data = {
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      createdBy: user.id,

      sourceId: dto.sourceId,
      number: dto.number,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      address: dto.address,
      status: ContactStatus.ACTIVE,
      numberStatus: NumberStatus.PENDING_VERIFICATION,

      ...(dto.birthDate
        ? (() => {
          const parsed = parseBirthAnniversaryDate(dto.birthDate);
          return {
            birthDate: parsed.date,
            birthYear: parsed.year,
            birthMonth: parsed.month,
            birthDay: parsed.day,
          };
        })()
        : {}),

      ...(dto.anniversaryDate
        ? (() => {
          const parsed = parseBirthAnniversaryDate(dto.anniversaryDate);
          return {
            anniversaryDate: parsed.date,
            anniversaryYear: parsed.year,
            anniversaryMonth: parsed.month,
            anniversaryDay: parsed.day,
          };
        })()
        : {}),
    };

    try {
      const contact = await this.prisma.contact.create({ data });

      console.log({
        dtoc: dto.contactCustomField,
      });

      if (dto.contactCustomField?.length) {
        await this.prisma.contactCustomField.createMany({
          data: dto.contactCustomField.map((field) => ({
            createdBy: user.id,
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            contactId: contact.id,
            customFieldId: BigInt(field.id),
            value: field.value,
          })),
        });
      }

      // check existing triggers if any then add new trigger to the queue
      await this.triggerEventManager.createTriggerEventQueue({
        agencyId: user.agencyId,
        userId: user.parentUserId ?? user.id,
        contactId: contact.id,
        eventKey: EventKeys.CONTACT_ADDED,
        payload: { contact: { displayName: getContactDisplayName(contact), number: contact.number, action: TRIGGER_EVENT_CONTACT_ACTIONS.CREATED } }
      });

      return contact;
    } catch (error) {
      this.logger.error(`Failed to create contact: ${error.message}`);
      throw new BadRequestException('Failed to create contact');
    }
  }


  async createBulkContacts(
    user: LoginUser,
    dto: BulkCreateContactDto
  ) {
    const data = dto.contacts.map((contact) => ({
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      sourceId: contact.sourceId,
      number: contact.number,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      countryCode: contact.countryCode,
      address: contact.address,
      status: ContactStatus.ACTIVE,
      numberStatus: NumberStatus.PENDING_VERIFICATION,

      ...(contact.birthDate
        ? (() => {
          const parsed = parseBirthAnniversaryDate(contact.birthDate);
          return {
            birthDate: parsed.date,
            birthYear: parsed.year,
            birthMonth: parsed.month,
            birthDay: parsed.day,
          };
        })()
        : {}),

      ...(contact.anniversaryDate
        ? (() => {
          const parsed = parseBirthAnniversaryDate(contact.anniversaryDate);
          return {
            anniversaryDate: parsed.date,
            anniversaryYear: parsed.year,
            anniversaryMonth: parsed.month,
            anniversaryDay: parsed.day,
          };
        })()
        : {}),
    }));

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Filter out duplicates
        const existingNumbers = await tx.contact.findMany({
          where: {
            agencyId: user.agencyId,
            userId: user.parentUserId ?? user.id,
            number: { in: dto.contacts.map((c) => c.number) },
          },
          select: { number: true },
        });
        const existingNumberSet = new Set(existingNumbers.map((n) => n.number));

        const filteredData = data.filter(
          (c) => !existingNumberSet.has(c.number),
        );

        // Bulk create the non-duplicates
        const createResult = await tx.contact.createMany({
          data: filteredData,
          skipDuplicates: true,
        });

        // Handle custom fields for the newly created ones
        for (const contact of dto.contacts) {
          if (existingNumberSet.has(contact.number)) continue; // Already exists → skip

          const newContact = await tx.contact.findFirst({
            where: { number: contact.number, userId: user.parentUserId ?? user.id },
            orderBy: { createdAt: 'desc' },
          });

          if (
            newContact &&
            contact.contactCustomField &&
            contact.contactCustomField.length > 0
          ) {
            await this.createCustomFieldsForContact({
              userId: user.parentUserId ?? user.id,
              agencyId: user.agencyId,
              contactId: newContact.id,
              customFields: contact.contactCustomField,
              tx,
            });
          }
        }

        return {
          count: createResult.count,
          createdNumbers: filteredData.map((c) => c.number),
        };
      });

      // Process triggers outside the tx
      if (result.createdNumbers?.length > 0) {
        const newContacts = await this.prisma.contact.findMany({
          where: {
            number: { in: result.createdNumbers },
            agencyId: user.agencyId,
            createdAt: { gte: new Date(Date.now() - 5000) },
          },
        });



        for (const contact of newContacts) {
          const matchingDtoItem = dto.contacts.find(
            (item) => item.number === contact.number,
          );
          if (matchingDtoItem) {

            // check existing triggers if any then add new trigger to the queue
            await this.triggerEventManager.createTriggerEventQueue({
              agencyId: user.agencyId,
              userId: user.parentUserId ?? user.id,
              contactId: contact.id,
              eventKey: EventKeys.CONTACT_ADDED,
              payload: { contact: { displayName: getContactDisplayName(contact), number: contact.number, action: TRIGGER_EVENT_CONTACT_ACTIONS.CREATED } }
            });

          }
        }
      }

      return { count: result.count };

    } catch (error) {
      this.logger.error(`Failed to create bulk contacts: ${error.message}`);
      throw new BadRequestException('Failed to create bulk contacts');
    }
  }



  private async createCustomFieldsForContact(
    {
      userId,
      agencyId,
      contactId,
      customFields,
      tx = this.prisma,
    }: {
      userId: bigint;
      agencyId: bigint;
      contactId: bigint;
      customFields: Record<string, any>;
      tx?: Prisma.TransactionClient;
    }
  ) {
    for (const [label, value] of Object.entries(customFields)) {
      let customField = await tx.customField.findFirst({
        where: { userId, agencyId, label },
      });

      if (!customField) {
        customField = await tx.customField.create({
          data: {
            userId,
            agencyId,
            key: label,
            label,
            type: typeof value === 'number' ? 'NUMBER' : typeof value === 'boolean' ? 'BOOLEAN' : 'STRING',
          },
        });
      }

      await tx.contactCustomField.create({
        data: {
          userId,
          createdBy: userId,
          agencyId,
          contactId,
          customFieldId: customField.id,
          value: String(value),
        },
      });
    }
  }



  /**
   *  Get contact list
   * @param userId 
   * @param dto 
   * @returns  Contacts[]
   */
  async getContactList(user: LoginUser, dto: GetContactsDto) {
    const {
      page,
      limit,
      query,
      segmentId,
      tagId,
      queueId,
      fileName,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = dto;

    // Initialize contact ID filters
    let contactIds: bigint[] | null = null;

    // Filter by tag
    if (tagId) {
      const tagContacts = await this.prisma.contactTag.findMany({
        where: { tagId: BigInt(tagId) },
        select: { contactId: true },
      });
      const tagContactIds = tagContacts.map(tc => tc.contactId);
      contactIds = contactIds ? this.intersect(contactIds, tagContactIds) : tagContactIds;
    }

    // Filter by segment
    if (segmentId) {
      const segmentContacts = await this.prisma.segmentContact.findMany({
        where: { segmentId: BigInt(segmentId) },
        select: { contactId: true },
      });
      const segmentContactIds = segmentContacts.map(sc => sc.contactId);
      contactIds = contactIds ? this.intersect(contactIds, segmentContactIds) : segmentContactIds;
    }

    // Filter by queue (file)
    if (queueId || fileName) {
      let queueContactIds: bigint[] = [];

      if (queueId) {
        const queueContacts = await this.prisma.contactImportQueueContact.findMany({
          where: { queueId: BigInt(queueId) },
          select: { contactId: true },
        });
        queueContactIds = queueContacts.map(qc => qc.contactId);
      } else if (fileName) {
        const queues = await this.prisma.contactImportQueue.findMany({
          where: {
            fileName: {
              contains: fileName,
            }
          },
          select: { id: true }
        });
        const queueIds = queues.map(q => q.id);

        if (queueIds.length > 0) {
          const queueContacts = await this.prisma.contactImportQueueContact.findMany({
            where: { queueId: { in: queueIds } },
            select: { contactId: true },
          });
          queueContactIds = queueContacts.map(qc => qc.contactId);
        }
      }

      contactIds = contactIds ? this.intersect(contactIds, queueContactIds) : queueContactIds;
    }

    // Validate pagination parameters
    const parsedPage = Math.max(1, Number(page));
    const parsedLimit = Math.min(Math.max(1, Number(limit)), 100);

    // Define allowed sort fields and order
    const validSortFields = ['firstName', 'lastName', 'createdAt', 'updatedAt'];
    const validSortOrders = ['asc', 'desc'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'asc';

    // Build the base where clause
    const baseWhere: Prisma.ContactWhereInput = {
      // userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
    };

    // Conditional filtering based on parentUserId
    if (user.parentUserId) {
      baseWhere.ContactAssignment = {
        some: {
          assignedTo: user.id,
        },
      };
    } else if (!user.parentUserId) {
      // User has no parent, show all contacts
      baseWhere.agencyId = user.agencyId;
    }

    // Apply contact ID filter if exists
    if (contactIds) {
      baseWhere.id = { in: contactIds };
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

    // Apply search
    // Apply search (works without `mode`, supports multi-word queries)
    let where = baseWhere;

    if (query?.trim()) {
      const trimmed = query.trim();
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      // Build tokenized AND-of-ORs: each token must match at least one searchable field
      const tokenFilters = tokens.map(token => ({
        OR: [
          { number: { contains: token } },
          { firstName: { contains: token } },
          { lastName: { contains: token } },
          { email: { contains: token } },
        ],
      }));

      // Also try direct matches against whole fields (useful if users paste full name)
      const directFullFieldMatch = [
        { number: { contains: trimmed } },
        { firstName: { contains: trimmed } },
        { lastName: { contains: trimmed } },
        { email: { contains: trimmed } },
      ];

      // Combine: either direct full-field match OR tokenized match requiring all tokens
      where = {
        ...baseWhere,
        OR: [
          ...directFullFieldMatch,
          { AND: tokenFilters },
        ],
      };
    }

    try {
      const [contacts, total] = await Promise.all([
        this.prisma.contact.findMany({
          where,
          take: parsedLimit,
          skip: (parsedPage - 1) * parsedLimit,
          orderBy: { [finalSortBy]: finalSortOrder },
          include: {
            user: {
              select: userSelect
            },
            ContactCustomField: {
              include: {
                customField: true
              }
            },
            ContactTag: {
              include: {
                tag: true
              }
            },
            SegmentContact: {
              include: {
                segment: true
              }
            },
            ContactImportQueueContact: {
              include: {
                queue: {
                  select: {
                    id: true,
                    fileName: true,
                    createdAt: true,
                    status: true
                  }
                }
              }
            }
          },
        }),
        this.prisma.contact.count({ where }),
      ]);

      return {
        contacts: contacts.map(contact => ({
          ...contact,
          segments: contact.SegmentContact.map(sc => sc.segment),
          tags: contact.ContactTag.map(ct => ct.tag),
        })),
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        message: contacts.length === 0 ? 'No contacts found for the given criteria.' : undefined,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma error: ${error.message}`, error.stack);
        return {
          contacts: [],
          total: 0,
          page: parsedPage,
          limit: parsedLimit,
          message: `Invalid query parameters: ${error.message}`,
        };
      }
      this.logger.error(`Failed to fetch contacts: ${error.message}`, error.stack);
      return {
        contacts: [],
        total: 0,
        page: parsedPage,
        limit: parsedLimit,
        message: 'An unexpected error occurred while fetching contacts.',
      };
    }
  }

  private intersect(a: bigint[], b: bigint[]): bigint[] {
    const setB = new Set(b);
    return a.filter(x => setB.has(x));
  }



  // delete contact from contact table with contactIds
  async deleteContacts(user: LoginUser, contactIds: number[]) {
    console.log("Deleting contacts with contactIds:", contactIds);
    try {
      const deletedContacts = await this.prisma.contact.deleteMany({
        where: { id: { in: contactIds }, userId: user.parentUserId ?? user.id, agencyId: user.agencyId },
      });
      return deletedContacts;
    } catch (error) {
      this.logger.error(`Failed to delete contact: ${error.message}`);
      throw error;
    }
  }
  async deleteAllContact(user: LoginUser) {
    const BATCH_SIZE = 1000;
    const userId = user.parentUserId ?? user.id;
    const agencyId = user.agencyId;

    let totalDeleted = 0;

    try {
      while (true) {
        const deleted = await this.prisma.$executeRawUnsafe<number>(
          `
        DELETE FROM contacts
        WHERE user_id = ? AND agency_id = ?
        LIMIT ?
        `,
          userId,
          agencyId,
          BATCH_SIZE
        );

        totalDeleted += deleted;

        if (deleted < BATCH_SIZE) break; // done, last batch was smaller
        this.logger.info(`🧹 Deleted ${deleted} contacts in batch...`);
      }

      this.logger.info(` Total deleted: ${totalDeleted} contacts`);
      return totalDeleted;
    } catch (error) {
      this.logger.error(`💥 Failed to delete contacts: ${error.message}`);
      throw error;
    }
  }


  async getContactDetails(user: LoginUser, contactId: bigint) {
    try {
      // also fetch the tag name with the tagId of the contactId
      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, userId: user.parentUserId ?? user.id },
        include: {
          ContactImportQueueContact: true, user: {
            select: {
              id: true,
              agencyId: true,
              userName: true,
              email: true,
              profileUrl: true,



            }
          }, ContactTag: { include: { tag: true } }, ContactCustomField: { include: { customField: true } }
        },
      });

      // console.log("Contact details fetched:", contact);
      if (!contact) throw new NotFoundException('Contact not found');
      // return just neccessery data
      return contact;
    } catch (error) {
      this.logger.error(`Failed to fetch contact detail: ${error.message}`);
      throw error;
    }
  }

  async updateContact(user: LoginUser, dto: UpdateContactDto, contactId: bigint) {
    try {
      // Fetch existing contact
      const existingContact = await this.prisma.contact.findFirst({
        where: { id: contactId, userId: user.parentUserId ?? user.id },
        include: { ContactCustomField: true },
      });

      if (!existingContact) {
        throw new NotFoundException("Contact not found");
      }

      // Original data (flattened for comparison)
      const originalData: Partial<UpdateContactDto> = {
        firstName: existingContact.firstName,
        lastName: existingContact.lastName,
        email: existingContact.email,
        city: existingContact.city,
        state: existingContact.state,
        country: existingContact.country,
        countryCode: existingContact.countryCode,
        address: existingContact.address,
        status: existingContact.status,
        numberStatus: existingContact.numberStatus,
        birthDate: existingContact.birthDate
          ? existingContact.birthDate.toISOString().split("T")[0]
          : undefined,
        anniversaryDate: existingContact.anniversaryDate
          ? existingContact.anniversaryDate.toISOString().split("T")[0]
          : undefined,
        contactCustomField: existingContact.ContactCustomField?.map((field) => ({
          id: String(field.customFieldId),
          defaultValue: field.value,
        })) as any,
      };

      // Incoming data (from DTO) - only include explicitly provided fields
      const incomingDto: Partial<UpdateContactDto> = _.pickBy(
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          city: dto.city,
          state: dto.state,
          country: dto.country,
          countryCode: dto.countryCode,
          address: dto.address,
          status: dto.status,
          numberStatus: dto.numberStatus,
          birthDate: dto.birthDate,
          anniversaryDate: dto.anniversaryDate,
          contactCustomField: dto.contactCustomField,
        },
        (value) => value !== undefined || value !== null || value !== ""
      );

      //  Get only changed fields (deep comparison)
      const changedFields = getChangedFields(originalData, incomingDto);

      // If no fields changed, just return success
      if (_.isEmpty(changedFields)) {
        return {
          status: "success",
          message: "No changes detected",
          data: existingContact,
        };
      }

      // Prepare contact update data
      const contactUpdateData: Record<string, any> = {
        ..._.pick(dto, [
          "firstName",
          "lastName",
          "email",
          "city",
          "state",
          "country",
          "address",
          "status",
          "numberStatus",
        ]),
        ...(dto.birthDate
          ? (() => {
            const parsed = parseBirthAnniversaryDate(dto.birthDate);
            return {
              birthDate: parsed.date,
              birthYear: parsed.year,
              birthMonth: parsed.month,
              birthDay: parsed.day,
            };
          })()
          : {}),
        ...(dto.anniversaryDate
          ? (() => {
            const parsed = parseBirthAnniversaryDate(dto.anniversaryDate);
            return {
              anniversaryDate: parsed.date,
              anniversaryYear: parsed.year,
              anniversaryMonth: parsed.month,
              anniversaryDay: parsed.day,
            };
          })()
          : {}),
      };

      // Execute transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const contact = await tx.contact.update({
          where: { id: contactId, userId: user.parentUserId ?? user.id },
          data: contactUpdateData,
          select: {
            id: true,
            userId: true,
            agencyId: true,
            birthDate: true,
            anniversaryDate: true,
            firstName: true,
            lastName: true,
            email: true,
            number: true,
          },
        });

        // Process custom fields if updated
        if (changedFields.contactCustomField && Array.isArray(dto.contactCustomField)) {
          const contactCustomField = dto.contactCustomField.map((field) => ({
            contactId,
            customFieldId: BigInt(field.id),
            value: field.value,
            userId: user.parentUserId ?? user.id,
            createdBy: user.id,
            agencyId: contact.agencyId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await tx.contactCustomField.deleteMany({ where: { contactId } });
          await tx.contactCustomField.createMany({ data: contactCustomField });
        }

        return contact;
      });

      //  Trigger event only with *actually* changed fields
      try {
        // Extract just the changed field keys (skip custom fields since they're separate)

        //########## Trigger Event for Contact Updated
        // const updatedFieldKeys = Object.keys(changedFields).filter(
        //   (key) => key !== 'contactCustomField'
        // );

        // await this.triggerEventManager.createTriggerEventQueue({
        //   agencyId: user.agencyId,
        //   userId: user.parentUserId ?? user.id,
        //   contactId: result.id,
        //   eventKey: EventKeys.CONTACT_ADDED,
        //   payload: {
        //     contact: {
        //       displayName: getContactDisplayName(result as Contact),
        //       number: result.number,
        //     },
        //     // Now it's precise: only real changes (e.g., ['firstName'] if that's all)
        //     updatedFields: updatedFieldKeys,
        //     action: TRIGGER_EVENT_CONTACT_ACTIONS.UPDATED,
        //   },
        // });
      } catch (error) {
        this.logger.error(`Error processing triggers for contact ${user.id}:`, error);
      }

      return {
        status: "success",
        message: "Contact updated successfully",
        data: result,
      };
    } catch (error: any) {
      console.error("Error updating contact:", error);
      if (error.code === "P2025") {
        throw new NotFoundException("Contact not found");
      }
      throw new BadRequestException(`Failed to update contact: ${error.message}`);
    }
  }



  async deleteUpload(user: LoginUser, uploadId: bigint) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.contact.deleteMany({ where: { ContactImportQueueContact: { some: { queueId: uploadId } }, userId: user.parentUserId ?? user.id } });
        return tx.contactImportQueue.delete({ where: { id: uploadId, userId: user.parentUserId ?? user.id } });
      });
    } catch (error) {
      this.logger.error(`Failed to delete upload: ${error.message}`);
      throw new BadRequestException('Failed to delete upload');
    }
  }

  async disconnectGoogleSheet(user: LoginUser, uploadId: bigint) {
    return this.deleteUpload(user, uploadId);
  }


  //contact queue list
  // In your service file


  async getContactQueueList(user: LoginUser, dto: GetContactQueueListDto) {
    const {
      page = '1',
      limit = '10',
      search,
      status,
      fileType
    } = dto;

    const parsedPage = Math.max(1, Number(page));
    const parsedLimit = Math.min(Math.max(1, Number(limit)), 100);

    // Base where conditions
    const baseWhere: Prisma.ContactImportQueueWhereInput = {
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
    };

    // Apply filters
    if (status) baseWhere.status = status;
    if (fileType) baseWhere.fileType = fileType;

    // Apply search if provided - using 'ALL' strategy for precision
    const where = search
      ? SearchUtils.applySearch<Prisma.ContactImportQueueWhereInput>(
        baseWhere,
        search,
        {
          fields: ['fileName'], // Add more fields as needed
          strategy: 'ALL', // 'EXACT', 'ALL', or 'ANY' - 'ALL' is the default
          minTermLength: 2,
          maxTerms: 5
        }
      )
      : baseWhere;

    try {
      const [queues, total] = await Promise.all([
        this.prisma.contactImportQueue.findMany({
          where,
          take: parsedLimit,
          skip: (parsedPage - 1) * parsedLimit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: userSelect
            },
          },
        }),
        this.prisma.contactImportQueue.count({ where }),
      ]);

      const mappedQueue = queues.map(queue => ({
        ...queue,
        fileSummary: queue.fileSummary && typeof queue.fileSummary === 'string' ? JSON.parse(queue.fileSummary) : null,
      }))

      return {
        queues: mappedQueue,
        total,
        filteredTotal: queues.length,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        message: queues.length === 0 ? 'No contact import queues found for the given criteria.' : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch contact queue list: ${error.message}`);
      throw new InternalServerErrorException(
        'An unexpected error occurred while fetching contact import queues.'
      );
    }
  }


  // getContactQueueListForFilter
  // getContactQueueListForFilter
  async getContactQueueListForFilter(user: LoginUser, dto: GetContactQueueListForFilterDto) {
    const { page, limit, status, fileType, fileName } = dto;

    // Base where clause
    const baseWhere: Prisma.ContactImportQueueWhereInput = {
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
    };

    // Apply status filter if provided
    if (status) baseWhere.status = status;
    if (fileType) baseWhere.fileType = fileType;

    // Apply search using SearchUtils if fileName is provided
    const where = fileName?.trim()
      ? SearchUtils.applySearch<Prisma.ContactImportQueueWhereInput>(
        baseWhere,
        fileName.trim(),
        {
          fields: ['fileName'],
          strategy: 'ALL', // All terms must be present
          minTermLength: 1,
          maxTerms: 10,
          caseSensitive: false
        }
      )
      : baseWhere;

    try {
      const [queues, total] = await Promise.all([
        this.prisma.contactImportQueue.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.contactImportQueue.count({ where }),
      ]);

      return {
        queues,
        total,
        filteredTotal: queues.length,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        message: queues.length === 0 ? 'No contact import queues found for the given criteria.' : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch contact queue list: ${error.message}`);
      throw new InternalServerErrorException(
        'An unexpected error occurred while fetching contact import queues.'
      );
    }
  }


  async assignTagsToContact(user: LoginUser, dto: AssignTagSingleDto) {
    const { contactId, tagIds } = dto;

    // Verify contact belongs to the logged-in user's agency
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId: user.id, agencyId: user.agencyId },
      select: { id: true, firstName: true, lastName: true, number: true, email: true },
    });

    if (!contact) return returnError(404, "Contact not found");

    // Verify tags exist and belong to the user's agency
    const validTags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, agencyId: user.agencyId },
      select: { id: true },
    });

    if (!validTags.length) return returnError(404, "No valid tags found");

    // Create contact-tag relationships (avoid duplicates)
    const createData = tagIds.map(tagId => ({
      contactId,
      tagId,
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      createdBy: user.id,
    }));

    await this.prisma.contactTag.createMany({
      data: createData,
      skipDuplicates: true,
    });



    // check and add CONTACT_TAG trigger event
    for (const tagId of tagIds) {
      await this.triggerEventManager.createTriggerEventQueue({
        agencyId: user.agencyId,
        userId: user.parentUserId ?? user.id,
        contactId,
        eventKey: EventKeys.CONTACT_TAG,
        payload: {
          contact: {
            displayName: getContactDisplayName(contact as Contact),
            number: contact.number
          },
          tagId: tagId.toString(),
          action: TRIGGER_FILTER_FIELDS.TAG_ADDED,
        },
      })
    }

    return { status: 200, message: "Tags assigned successfully" };
  }

  async assignTagsToMultipleContacts(user: LoginUser, dto: AssignTagMultipleDto) {
    const { contactIds, tagIds } = dto;

    // Verify contacts belong to the user
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: contactIds }, userId: user.id, agencyId: user.agencyId },
      select: { id: true, firstName: true, lastName: true, number: true, email: true },
    });
    const validContactIds = contacts.map(c => c.id);

    if (!validContactIds.length) return returnError(404, "No valid contacts found");

    // Verify tags exist and belong to the user's agency
    const validTags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, agencyId: user.agencyId },
      select: { id: true },
    });

    if (!validTags.length) return returnError(404, "No valid tags found");

    // Prepare all contact-tag pairs
    const createData: { contactId: bigint; tagId: number; agencyId: bigint; userId: bigint; createdBy: bigint }[] = [];
    validContactIds.forEach(contactId => {
      tagIds.forEach(tagId => createData.push({ contactId, tagId, agencyId: user.agencyId, userId: user.parentUserId ?? user.id, createdBy: user.id }));
    });

    const result = await this.prisma.contactTag.createMany({
      data: createData,

      skipDuplicates: true,
    });


    // Add CONTACT_TAG trigger events for each contact-tag pair
    for (const contact of contacts) {
      for (const tagId of tagIds) {
        await this.triggerEventManager.createTriggerEventQueue({
          agencyId: user.agencyId,
          userId: user.parentUserId ?? user.id,
          contactId: contact.id,
          eventKey: EventKeys.CONTACT_TAG,
          payload: {
            contact: {
              displayName: getContactDisplayName(contact as Contact),
              number: contact.number
            },
            tagId: tagId.toString(), // Convert to string to match validator
            action: TRIGGER_FILTER_FIELDS.TAG_ADDED,
          },
        });
      }
    }

    return { status: 200, message: "Tags assigned to multiple contacts successfully", data: result };
  }

  // contact-tag.service.ts
  async removeTagFromContact(user: LoginUser, dto: RemoveTagDto) {
    try {
      const { contactIds, tagIds } = dto;

      // Verify contacts belong to the user
      const contacts = await this.prisma.contact.findMany({
        where: { id: { in: contactIds }, userId: user.id, agencyId: user.agencyId },
        select: { id: true, firstName: true, lastName: true, number: true, email: true },
      });
      const validContactIds = contacts.map(c => c.id);

      if (!validContactIds.length) return returnError(404, "No valid contacts found");

      // Verify tags exist and belong to the user's agency
      const validTags = await this.prisma.tag.findMany({
        where: { id: { in: tagIds }, agencyId: user.agencyId },
        select: { id: true },
      });

      if (!validTags.length) return returnError(404, "No valid tags found");

      // Prepare all contact-tag pairs
      const deleteData: { contactId: bigint; tagId: number }[] = [];
      validContactIds.forEach(contactId => {
        tagIds.forEach(tagId => deleteData.push({ contactId, tagId }));
      });

      await this.prisma.contactTag.deleteMany({
        where: {
          contactId: { in: validContactIds },
          tagId: { in: tagIds },
        },
      });

      // Add CONTACT_TAG trigger events for each contact-tag pair
      for (const contact of contacts) {
        for (const tagId of tagIds) {
          await this.triggerEventManager.createTriggerEventQueue({
            agencyId: user.agencyId,
            userId: user.parentUserId ?? user.id,
            contactId: contact.id,
            eventKey: EventKeys.CONTACT_TAG,
            payload: {
              contact: {
                displayName: getContactDisplayName(contact as Contact),
                number: contact.number
              },
              tagId: tagId.toString(), // Convert to string to match validator
              action: TRIGGER_FILTER_FIELDS.TAG_REMOVED,
            },
          });
        }
      }

      return { status: 200, message: "Tags removed from multiple contacts successfully" };
    } catch (error) {
      this.logger.error(`Failed to remove tag from contact: ${error.message}`);
      throw new BadRequestException('Failed to remove tag from contact');
    }
  }

  async assignContactToTeamMember(user: LoginUser, dto: AssignContactsDto) {

    // Validate member user
    const member = await this.prisma.user.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new Error('Team member not found');

    const memberTeamRecord = await this.prisma.teamMember.findFirst({
      where: { memberId: dto.memberId },
      include: { team: true },
    });

    if (!memberTeamRecord || !memberTeamRecord.team) {
      throw new Error('This user is not part of any team');
    }

    const team = memberTeamRecord.team;

    // Check permission: Admin, Team Owner, or Team Leader
    const teamMemberRole = await this.prisma.teamMember.findFirst({
      where: { teamId: team.id, memberId: user.id },
    });

    const allowedRoles = [RoleDTO.ADMIN_ROLE_NAME, TeamRole.OWNER, TeamRole.LEADER];

    if (!allowedRoles.includes(user.roleName)) {
      throw new Error("You are not allowed to perform this action");
    }

    const isAdmin = user.roleName === RoleDTO.ADMIN_ROLE_NAME;
    const isOwner = team.ownerId === user.id;
    const isLeader = teamMemberRole?.teamRole === TeamRole.LEADER;

    if (!(isAdmin || isOwner || isLeader)) {
      throw new Error('You do not have permission to assign contacts');
    }

    // Assign contacts (skip duplicates)
    const assignments = [];

    for (const contactId of dto.contactIds) {

      try {

        const assignment = await this.prisma.contactAssignment.create({
          data: {
            agencyId: user.agencyId,
            userId: user.parentUserId ?? user.id,
            contactId,
            assignedBy: user.id,
            assignedTo: dto.memberId as bigint,
            createdAt: new Date(),
            updatedAt: new Date()

          }
        });

        assignments.push(assignment);

      } catch (error) {
        console.log(error);
      }


    }

    return {
      status: 200,
      message: `contacts assigned successfully`,
      data: {},
    };
  }

  async removeContactsFromMember(user: LoginUser, dto: RemoveContactAssignmentsDto) {
    // Only ADMIN, OWNER, or LEADER can remove
    const allowedRoles = [RoleDTO.ADMIN_ROLE_NAME, TeamRole.OWNER, TeamRole.LEADER];
    if (!allowedRoles.includes(user.roleName)) {
      throw new Error("You are not allowed to remove contact assignments");
    }

    // Ensure the member exists
    const member = await this.prisma.user.findUnique({
      where: { id: BigInt(dto.memberId) },
    });
    if (!member) throw new NotFoundException("Member not found");

    //  Ensure the contacts exist
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: dto.contactIds.map((id) => BigInt(id)) } },
    });
    if (contacts.length !== dto.contactIds.length) {
      throw new Error("Some contacts not found");
    }

    // Find which assignments exist before deleting
    const existingAssignments = await this.prisma.contactAssignment.findMany({
      where: {
        agencyId: user.agencyId,
        userId: user.parentUserId ?? user.id,
        assignedTo: BigInt(dto.memberId),
        contactId: { in: dto.contactIds.map((id) => BigInt(id)) },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            number: true,
            email: true,
            status: true
          }
        }, // to return contact details (id, name, phone, etc.)
      },
    });

    if (!existingAssignments.length) {
      return {
        status: 200,
        message: "No matching contact assignments found to remove",
        removedContacts: [],
      };
    }

    // Delete them
    const result = await this.prisma.contactAssignment.deleteMany({
      where: {
        id: { in: existingAssignments.map((a) => a.id) },
      },
    });

    return {
      status: 200,
      message: `${result.count} contacts removed successfully from member`,
      removedContacts: existingAssignments.map((a) => ({
        id: a.contactId,
        ...a.contact, // includes contact fields (if needed)
      })),
    };
  }

  async getContactsOfMember(user: LoginUser, dto: GetMemberContactsDto) {
    const {
      page = 1,
      perPage = 10,
      sortOn = 'created_at',
      sortDirection = 'desc',
      query,
      needPagination = true,
    } = dto;

    // Role check
    const allowedRoles = [RoleDTO.ADMIN_ROLE_NAME, TeamRole.OWNER, TeamRole.LEADER];
    if (!allowedRoles.includes(user.roleName)) {
      throw new Error('You are not allowed to view member contacts');
    }

    // Ensure member exists
    const member = await this.prisma.user.findUnique({
      where: { id: BigInt(dto.memberId) },
    });
    if (!member) throw new Error('Member not found');

    const safePerPage = Math.max(1, Math.min(100, Number(perPage)));
    const safePage = Math.max(1, Number(page));
    const offset = (safePage - 1) * safePerPage;
    const allowedSortFields = new Set(['created_at']);
    const sortField = allowedSortFields.has(sortOn) ? sortOn : 'created_at';
    const sortDir = sortDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build search condition
    let searchClause = '';
    if (query) {
      const s = query.replace(/'/g, "''"); // Escape single quotes
      searchClause = `
      AND (
        LOWER(contacts.first_name) LIKE LOWER('%${s}%') OR
        LOWER(contacts.last_name) LIKE LOWER('%${s}%') OR
        LOWER(contacts.email) LIKE LOWER('%${s}%') OR
        LOWER(contacts.number) LIKE LOWER('%${s}%')
      )
    `;
    }

    const baseWhere = `
    contact_assignments.assigned_to = ${dto.memberId} AND
    contact_assignments.agency_id = ${user.agencyId} AND
    contact_assignments.user_id = ${user.parentUserId ?? user.id}
    ${searchClause}
  `;

    // Total count
    const totalResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count
     FROM contact_assignments
     JOIN contacts ON contacts.id = contact_assignments.contact_id
     WHERE ${baseWhere}`
    );
    const total = Number(totalResult[0]?.count ?? 0);

    // Fetch paginated rows
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT 
        contacts.id,
        contacts.number,
        contacts.first_name as firstName,
        contacts.last_name as lastName,
        contacts.email,
        contacts.city,
        contacts.state,
        contacts.country,
        contact_assignments.created_at as assignedAt
     FROM contact_assignments
     JOIN contacts ON contacts.id = contact_assignments.contact_id
     WHERE ${baseWhere}
     ORDER BY contact_assignments.${sortField} ${sortDir}
     ${needPagination ? `LIMIT ${safePerPage} OFFSET ${offset}` : ''}`
    );

    if (needPagination) {
      const totalPages = Math.max(1, Math.ceil(total / safePerPage));
      const pagination: PaginationMetaDto = {
        total,
        perPage: safePerPage,
        currentPage: safePage,
        totalPages,
        nextPage: safePage < totalPages ? safePage + 1 : undefined,
        prevPage: safePage > 1 ? safePage - 1 : undefined,
      };

      return {
        statusCode: 200,
        message: 'Contacts retrieved successfully.',
        data: rows,
        pagination,
      };
    }

    return {
      statusCode: 200,
      message: 'Contacts retrieved successfully.',
      data: rows,
    };
  }


  /* contact details */
  async getContactDetailsById(id: bigint) {
    return this.prisma.contact.findFirst({
      where: {
        id: id
      },
      select: {
        number: true,
        status: true
      }
    })
  }


  /**
   * @find active contact by id
   * @param id 
   * @returns 
   */
  async findActiveContactById(id: bigint) {
    if (!id) return null;

    try {
      return this.prisma.contact.findFirst({
        where: {
          id: id,
          status: ContactStatus.ACTIVE
        },
        select: {
          id: true,
          userId: true,
          agencyId: true,
          createdBy: true,
          number: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true
        }
      });
    } catch (error) {
      this.logger.error(`Failed to find active contact by id: ${error.message}`);
    }
    return null;
  }

  async assignOrUpdateWhatsAppNumberAssignmentBulk(user: LoginUser, memberId: number, accounts: string[]) {
    // 1️⃣ Validate member existence
    const member = await this.prisma.user.findFirst({
      where: {
        id: BigInt(memberId),
        agencyId: BigInt(user.agencyId),
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found in this agency.');
    }

    const results = [];

    for (const account of accounts) {
      // 2️⃣ Find WA Business Number by number or ID
      const waNumber = await this.prisma.waBusinessNumber.findFirst({
        where: {
          OR: [
            { number: account.trim() },
            { phoneNumberId: account.trim() },
          ],
          agencyId: BigInt(user.agencyId),
        },
      });

      console.log('Processing account:', account, 'Found:', !!waNumber, 'ID:', waNumber?.id);

      if (!waNumber) continue; // Skip invalid numbers

      // 3️⃣ Check existing assignment
      const existingAssignment = await this.prisma.assignedWhatsappNumber.findFirst({
        where: {
          waBusinessNumberId: waNumber.id,
          agencyId: BigInt(user.agencyId),
        },
      });

      let action = 'created';
      let assignment;

      if (existingAssignment) {
        // If assigned to same member → skip
        if (existingAssignment.assignedTo === BigInt(memberId)) {
          assignment = existingAssignment;
        } else {
          // Update to new member
          assignment = await this.prisma.assignedWhatsappNumber.update({
            where: { id: existingAssignment.id },
            data: {
              assignedTo: BigInt(memberId),
              assignedBy: BigInt(user.id),
              updatedAt: new Date(),
            },
            include: {
              waBusinessNumber: { select: { id: true, number: true, displayPhoneNumber: true } },
              assignedToUser: { select: { id: true, email: true, userName: true } },
            },
          });
          action = 'updated';
        }
      } else {
        // Create new assignment
        assignment = await this.prisma.assignedWhatsappNumber.create({
          data: {
            agencyId: BigInt(user.agencyId),
            userId: BigInt(user.id),
            waBusinessNumberId: waNumber.id,
            assignedBy: BigInt(user.id),
            assignedTo: BigInt(memberId),
          },
          include: {
            waBusinessNumber: { select: { id: true, number: true, displayPhoneNumber: true } },
            assignedToUser: { select: { id: true, email: true, userName: true } },
          },
        });
        action = 'created';
      }

      // 4️⃣ Log activity
      await createActivity({
        userId: user.parentUserId ?? user.id,
        agencyId: BigInt(user.agencyId),
        createdBy: user.id,
        action: ActivityAction.ASSIGN,
        category: ActivityCategory.CONTACT,
        description: `WhatsApp Number ${waNumber.number} ${action === 'created' ? 'assigned' : 'reassigned'} to ${member.userName} at ${new Date().toLocaleString()}.`,
      });

      results.push({ account: account, action, assignment });
    }

    return {
      message: "WhatsApp accounts processed successfully.",
      results,
    };
  }

  // whatsapp-assignments.service.ts
  async unassignWhatsAppNumberFromMember(
    user: LoginUser,
    memberId: bigint,
    accounts: string[]
  ) {
    const waNumbers = await this.prisma.waBusinessNumber.findMany({
      where: {
        OR: [
          { phoneNumberId: { in: accounts } },
          {
            id: {
              in: accounts
                .map(a => (!isNaN(Number(a)) ? BigInt(a) : undefined))
                .filter(Boolean),
            },
          },
        ],
        agencyId: BigInt(user.agencyId),
      },
      select: { id: true, number: true, phoneNumberId: true },
    });

    if (!waNumbers.length) {
      throw new Error('No matching WhatsApp Business numbers found.');
    }

    const waNumberIds = waNumbers.map(n => n.id);

    const existingAssignments = await this.prisma.assignedWhatsappNumber.findMany({
      where: {
        assignedTo: memberId,
        waBusinessNumberId: { in: waNumberIds },
        agencyId: BigInt(user.agencyId),
      },
    });

    if (!existingAssignments.length) {
      throw new Error('No WhatsApp numbers are currently assigned to this member.');
    }

    await Promise.all(
      existingAssignments.map(a =>
        this.prisma.assignedWhatsappNumber.delete({ where: { id: a.id } })
      )
    );

    await createActivity({
      userId: user.parentUserId ?? user.id,
      agencyId: user.agencyId,
      createdBy: user.id,
      action: ActivityAction.DELETE,
      category: ActivityCategory.WA_BUSINESS_NUMBER,
      description: `Unassigned  WhatsApp number(s) from ${memberId} at ${new Date().toLocaleString()}.`,
    });

    // ✅ Standard response
    return {
      responseCode: 200,
      success: true,
      message: `Successfully unassigned ${existingAssignments.length} WhatsApp number(s) from member.`
    };
  }


  async getWhatsAppNumberList(user: LoginUser) {
    const waNumbers = await this.prisma.waBusinessNumber.findMany({
      where: {
        userId: user.parentUserId ?? user.id,
        agencyId: BigInt(user.agencyId),
        numberStatus: WaNumberStatus.VERIFIED
      },
      select: {
        id: true,
        number: true,
        displayPhoneNumber: true,
        verifiedName: true,
        phoneNumberId: true,
        wabaAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return {
      message: 'WhatsApp Business Numbers fetched successfully.',
      total: waNumbers.length,
      results: waNumbers,
    };

  }

  async getAssignedWhatsAppNumbers(user: LoginUser, dto: GetAssignedWhatsAppNumbersDto) {
    const { memberId, sortOn, sortDirection, query } = dto;

    const whereCondition: any = {
      agencyId: BigInt(user.agencyId),
      assignedTo: BigInt(memberId),
    };

    // 🔍 Optional search on WA number
    if (query && query.trim() !== '') {
      whereCondition.OR = [
        { waBusinessNumber: { number: { contains: query.trim() } } },
        { waBusinessNumber: { verifiedName: { contains: query.trim() } } },
        { assignedByUser: { userName: { contains: query.trim() } } },
      ];
    }

    // ⚙️ Sorting field mapping
    const sortFieldMap: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      number: 'waBusinessNumber.number',
    };

    const orderByField = sortFieldMap[sortOn] || 'createdAt';

    // ⚡ Fetch assigned WhatsApp numbers
    const assignments = await this.prisma.assignedWhatsappNumber.findMany({
      where: whereCondition,
      orderBy: {
        [orderByField]: sortDirection,
      },
      include: {
        waBusinessNumber: {
          select: {
            id: true,
            number: true,
            displayPhoneNumber: true,
            verifiedName: true,
            phoneNumberId: true,
            wabaAccount: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return {
      data: assignments.map(a => ({
        waBusinessNumber: a.waBusinessNumber,
      })),
      responseCode: 200,
      success: true,
    };
  }

}