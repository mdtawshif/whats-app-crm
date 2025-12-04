import { Injectable } from '@nestjs/common';
import { PrismaService } from "nestjs-prisma";
import { CreateTagDto, TagListItemDto, TagListParamDto, UpdateTagDto } from "./dto/create-tag.dto";
import { returnError, returnSuccess } from "@/common/helpers/response-handler.helper";
import { LoginUser } from "../auth/dto/login-user.dto";
import { ApiListResponseDto } from '@/common/dto/api-list-response.dto';

@Injectable()
export class TagService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async createTag(user: LoginUser, dto: CreateTagDto) {

    const exists = await this.prisma.tag.count({
      where: {
        userId: user.parentUserId || user.id,
        title: dto.title,
      },
    });

    if (exists > 0) {
      throw new Error('Tag with this title already exists for this agency');
    }

    const newTag = await this.prisma.tag.create({
      data: {
        title: dto.title,
        description: dto.description,
        userId: user.parentUserId || user.id,
        createdBy: user.id,
        agencyId: user.agencyId
      }
    });

    return returnSuccess(200, 'Tag created successfully', newTag);
  }

  async getTags(
    user: LoginUser,
    query: TagListParamDto
  ): Promise<ApiListResponseDto<TagListItemDto>> {
    const {
      page = 1,
      perPage = 10,
      sortOn,
      sortDirection,
      needPagination,
      query: searchQuery,
    } = query;

    const where: any = { agencyId: user.agencyId, userId: user.parentUserId || user.id };

    // Case-insensitive search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      where.OR = [
        { title: { contains: lowerQuery } },
        { title: { startsWith: lowerQuery } },
        { title: { endsWith: lowerQuery } },
      ];
    }

    const orderBy: any = sortOn ? { [sortOn]: sortDirection || 'desc' } : { createdAt: 'desc' };

    let tags: TagListItemDto[] = [];
    let total = 0;

    if (needPagination) {
      [tags, total] = await this.prisma.$transaction([
        this.prisma.tag.findMany({
          where,
          orderBy,
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        this.prisma.tag.count({ where }),
      ]);
    } else {
      tags = await this.prisma.tag.findMany({ where, orderBy });
      total = tags.length;
    }

    const tagsList: TagListItemDto[] = await Promise.all(
      tags.map(async (tag) => ({
        id: tag.id,
        userId: tag.userId || undefined,
        agencyId: tag.agencyId,
        createdBy: tag.createdBy || undefined,
        title: tag.title || '',
        description: tag.description,
        contactCount: await this.prisma.contactTag.count({ where: { tagId: tag.id } }),
        createdAt: tag.createdAt || undefined,
      }))
    );

    // console.log("tagsList", tagsList);

    const response: ApiListResponseDto<TagListItemDto> = {
      statusCode: 200,
      message: 'Tags fetched successfully',
      data: tagsList,
    };

    // Only attach pagination if needed
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
  }

  async updateTag(user: LoginUser, dto: UpdateTagDto, id: bigint) {

    const tag = await this.prisma.tag.count({
      where: { id },
    });

    if (tag === 0) return returnError(404, "Tag not found");

    const updatedTag = await this.prisma.tag.update({
      where: {
        id: id
      },
      data: {
        title: dto.title,
        description: dto.description
      }
    });

    return returnSuccess(200, 'Tag updated successfully', {
      id: updatedTag.id,
      title: updatedTag.title,
      description: updatedTag.description
    });
  }

  async deleteTag(user: LoginUser, id: bigint) {
    // Verify the tag belongs to the user's agency
    const tag = await this.prisma.tag.findFirst({
      where: { id },
    });
    if (!tag) return returnError(404, "Tag not found");

    const deleted = await this.prisma.$transaction([
      // 1. Delete all related ContactTag entries
      this.prisma.contactTag.deleteMany({
        where: { tagId: id },
      }),
      // 2. Delete the tag itself
      this.prisma.tag.delete({
        where: { id },
      }),
    ]);

    return returnSuccess(200, 'Tag deleted successfully', deleted[1]);
  }



}
