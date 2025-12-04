import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreatePersonalizationDto } from './dto/create-personalization.dto';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { ApiCreateResponseDto } from '@/common/dto/api-create-response.dto';
import { PersonalizationDto } from './dto/personalization.dto';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
import { PersonalizationListItemDto, PersonalizationListParamDto, PersonalizationItemDto, PersonalizationGroup } from './dto/personalization.listitem.dto';
import { ApiViewResponseDto } from '../../common/dto/api-view-response.dto';
import { ApiUpdateResponseDto } from '../../common/dto/api-update-response.dto';
import { ApiDeleteResponseDto } from '../../common/dto/api-delete-response.dto';
import { PrismaService } from 'nestjs-prisma';
import { LoginUser } from '../auth/dto/login-user.dto';
import { Prisma } from '@prisma/client';
import { normalizeKey } from './utils/personalization-helper';

@Injectable()
export class PersonalizationService {

  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async create(
    user: LoginUser,
    createPersonalizationDto: CreatePersonalizationDto
  ): Promise<ApiCreateResponseDto<PersonalizationDto>> {
    try {

      // Normalize key
      let normalizedKey = await normalizeKey(createPersonalizationDto.key);

      const personalization = await this.prisma.personalization.create({
        data: {
          userId: user.parentUserId ? user.parentUserId : user.id,
          createdBy: user.id,
          agencyId: user.agencyId,
          key: normalizedKey,
          label: createPersonalizationDto.label,
          type: createPersonalizationDto.type,
          value: createPersonalizationDto.value ?? null
        },
      });

      return {
        statusCode: 201,
        message: 'Personalization created successfully.',
        data: personalization,
      };

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint violation
        if (error.code === 'P2002') {
          throw new HttpException(
            `Personalization with key "${createPersonalizationDto.key}" already exists for this agency.`,
            HttpStatus.CONFLICT,
          );
        }
      }

      // Fallback for unexpected errors
      throw new HttpException(
        'Failed to create personalization.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findList(
    user: LoginUser
  ): Promise<ApiListResponseDto<PersonalizationItemDto>> {

    try {
      let userDefinePersonalizations: PersonalizationItemDto[] = [];

      // Fetch user-defined personalizations
      userDefinePersonalizations = await this.prisma.personalization.findMany({
        where: {
          userId: user.parentUserId ? user.parentUserId : user.id
        },
        select: {
          key: true,
          label: true,
        },
      });

      let customPersonalizations: PersonalizationItemDto[] = [];

      // Fetch custom field personalizations
      customPersonalizations = await this.prisma.customField.findMany({
        where: {
          userId: user.parentUserId ? user.parentUserId : user.id
        },
        select: {
          key: true,
          label: true,
        },
      });

      // Map user-defined personalizations
      const userDefineDtos: PersonalizationItemDto[] = userDefinePersonalizations.map((p) => ({
        key: p.key.toUpperCase(),
        label: p.label,
        group: PersonalizationGroup.USER_DEFINED, // Assign proper group
      }));

      // Map custom field personalizations
      const customDtos: PersonalizationItemDto[] = customPersonalizations.map((p) => ({
        key: p.key.toUpperCase(),
        label: p.label,
        group: PersonalizationGroup.CONTACT, // Assign proper group
      }));

      // Predefined personalization items
      const predefinedPersonalizations: PersonalizationItemDto[] = [
        { key: '{{FIRST_NAME}}', label: 'First Name', group: PersonalizationGroup.CONTACT },
        { key: '{{LAST_NAME}}', label: 'Last Name', group: PersonalizationGroup.CONTACT },
        { key: '{{FULL_NAME}}', label: 'Full Name', group: PersonalizationGroup.CONTACT },
        { key: '{{BIRTH_DAY}}', label: 'Birth Day', group: PersonalizationGroup.CONTACT },
        { key: '{{ANNIVERSARY_DAY}}', label: 'Anniversary Day', group: PersonalizationGroup.CONTACT },
      ];

      // Merge both lists
      const allPersonalizations: PersonalizationItemDto[] = [
        ...userDefineDtos,
        ...customDtos,
        ...predefinedPersonalizations,
      ];

      const response: ApiListResponseDto<PersonalizationItemDto> = {
        statusCode: 200,
        message: 'Personalizations fetched successfully.',
        data: allPersonalizations,
      };

      return response;

    } catch (error) {
      console.log(error);
      throw new HttpException(
        'An unexpected error occurred while fetching personalizations.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

  }

  async findAll(
    user: LoginUser,
    query: PersonalizationListParamDto
  ): Promise<ApiListResponseDto<PersonalizationListItemDto>> {
    const {
      page = 1,
      perPage = 10,
      sortOn = 'id',
      sortDirection = 'desc',
      query: searchQuery, // 👈 search term
      needPagination,
    } = query;

    // Build search OR without `mode`
    const searchOr = searchQuery
      ? [
        { key: { contains: searchQuery } },
        { key: { startsWith: searchQuery } },
        { key: { endsWith: searchQuery } },
        { label: { contains: searchQuery } },
        { value: { contains: searchQuery } },
      ]
      : undefined;

    const where: any = {
      userId: user.parentUserId ? user.parentUserId : user.id,
      agencyId: user.agencyId,
      ...(searchOr ? { OR: searchOr } : {}),
    };


    console.log('where', where);
    console.log('sortOn', sortOn);
    console.log('sortDirection', sortDirection);

    const orderBy: any = { [sortOn]: sortDirection };

    try {
      let personalizations: PersonalizationListItemDto[] = [];
      let total = 0;

      if (needPagination) {
        [personalizations, total] = await this.prisma.$transaction([
          this.prisma.personalization.findMany({
            where,
            orderBy,
            skip: (page - 1) * perPage,
            take: perPage,
          }),
          this.prisma.personalization.count({ where }),
        ]);
      } else {
        personalizations = await this.prisma.personalization.findMany({ where, orderBy });
        total = personalizations.length;
      }

      const personalizationDtos: PersonalizationListItemDto[] = personalizations.map((p) => ({
        id: p.id,
        key: p.key.toUpperCase(), // keys in uppercase
        label: p.label,
        type: p.type,
        value: p.value,
        userId: user.id,
        agencyId: user.agencyId,
      }));

      const response: ApiListResponseDto<PersonalizationListItemDto> = {
        statusCode: 200,
        message: 'Personalizations fetched successfully.',
        data: personalizationDtos,
      };

      if (needPagination) {
        response.pagination = {
          total,
          perPage,
          currentPage: page,
          totalPages: Math.ceil(total / perPage),
          nextPage: page * perPage < total ? page + 1 : undefined,
          prevPage: page > 1 ? page - 1 : undefined,
        };
      }

      return response;

    } catch (error) {
      console.log(error);
      throw new HttpException(
        'An unexpected error occurred while fetching personalizations.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async findOne(
    user: LoginUser,
    id: number
  ): Promise<ApiViewResponseDto<PersonalizationDto>> {
    try {
      const personalization = await this.prisma.personalization.findFirst({
        where: {
          id,
          userId: user.id,
          agencyId: user.agencyId,
        },
      });

      if (!personalization) {
        throw new HttpException(
          `Personalization with id ${id} not found or you don't have access.`,
          HttpStatus.NOT_FOUND
        );
      }

      return {
        statusCode: 200,
        message: 'Personalization fetched successfully.',
        data: personalization,
      };
    } catch (error) {
      throw new HttpException(
        'An unexpected error occurred while fetching personalization.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async update(
    user: LoginUser,
    id: number,
    updatePersonalizationDto: UpdatePersonalizationDto
  ): Promise<ApiUpdateResponseDto<PersonalizationDto>> {
    try {

      // Normalize key
      let normalizedKey = await normalizeKey(updatePersonalizationDto.key);
      // Use updateMany to enforce user & agency ownership
      const updated = await this.prisma.personalization.updateMany({
        where: {
          id,
          userId: user.id,
          agencyId: user.agencyId,
        },
        data: {
          key: normalizedKey ?? undefined,
          label: updatePersonalizationDto.label ?? undefined,
          type: updatePersonalizationDto.type ?? undefined,
          value: updatePersonalizationDto.value ?? undefined,
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new HttpException(
          `Personalization with id ${id} not found or you don't have permission to update it.`,
          HttpStatus.NOT_FOUND
        );
      }

      // Fetch updated record
      const personalization = await this.prisma.personalization.findUnique({
        where: { id },
      });

      return {
        statusCode: 200,
        message: 'Personalization updated successfully.',
        data: personalization,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new HttpException(
          'Failed to update personalization due to database error.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        'An unexpected error occurred while updating personalization.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async remove(
    user: LoginUser,
    id: number
  ): Promise<ApiDeleteResponseDto> {
    try {
      // Attempt to delete the personalization
      const deleted = await this.prisma.personalization.deleteMany({
        where: {
          id,
          userId: user.id,     // ensure user owns this personalization
          agencyId: user.agencyId, // ensure correct agency
        },
      });

      if (deleted.count === 0) {
        throw new HttpException(
          `Personalization with id ${id} not found or you don't have permission to delete it.`,
          HttpStatus.NOT_FOUND
        );
      }

      return {
        statusCode: 200,
        message: 'Personalization deleted successfully.',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle known Prisma errors if needed
        throw new HttpException(
          'Failed to delete personalization due to database error.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // fallback for unknown errors
      throw new HttpException(
        'An unexpected error occurred while deleting personalization.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

}
