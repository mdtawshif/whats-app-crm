// src/modules/contacts/dto/get-contacts.dto.ts
import { IsOptional, IsInt, IsString, IsEnum, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { ContactSource, ContactStatus, ContactImportQueueStatus } from '@prisma/client';
import { FileType } from "@prisma/client";
import { CommonFilterDto } from 'src/modules/common/dto/common-filter.dto';
import { Query } from "@nestjs/common";
import { BasePaginationDto } from '@/common/dto/base-pagination.dto';

export class GetContactQueueListDto {
  @ApiProperty({ example: 1, required: false, description: 'Page number for pagination' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @ApiProperty({ example: 10, required: false, description: 'Number of items per page' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 10;

  @ApiProperty({ example: 'search text', required: false, description: 'Search filter' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ example: ContactImportQueueStatus.PENDING, enum: ContactImportQueueStatus, required: false })
  @IsOptional()
  @IsEnum(ContactImportQueueStatus)
  status?: ContactImportQueueStatus;

  //FileType
  @ApiProperty({ example: FileType.CSV, enum: FileType, required: false })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;
};

export class GetContactQueueListForFilterDto {

  @ApiProperty({ example: 1, required: false, description: 'Page number for pagination' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @ApiProperty({ example: 10, required: false, description: 'Number of items per page' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 10;


  @ApiProperty({ example: 'search text', required: false, description: 'Search filter with file name' })
  @IsOptional()
  @IsString()
  fileName?: string;


  // status
  @ApiProperty({ example: ContactImportQueueStatus.PENDING, enum: ContactImportQueueStatus, required: false })
  @IsOptional()
  @IsEnum(ContactImportQueueStatus)
  status?: ContactImportQueueStatus;


  // fileType
  @ApiProperty({ example: FileType.CSV, enum: FileType, required: false })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;




}

export class GetContactsDto {
  @ApiProperty({ example: 1, required: false, description: 'Page number for pagination' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ example: 10, required: false, description: 'Number of contacts per page' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;



  //@ApiProperty({ example: ContactSource.MANUAL, enum: ContactSource, required: false })
  @IsOptional()
  //@IsEnum(ContactSource)
  source?: ContactSource;
  // status is enum

  @ApiProperty({ example: ContactStatus.ACTIVE, enum: ContactStatus, required: false })
  @IsOptional()
  @IsString()
  status?: ContactStatus;

  @ApiProperty({ example: 'segmentId123', required: false, description: 'Filter by segment ID' })
  @IsOptional()
  @IsString()
  segmentId?: string;

  @ApiProperty({ example: 'assigneeId123', required: false, description: 'Filter by assignee team member ID' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiProperty({ example: 'number', required: false, description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ example: 'asc', required: false, description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  // tags
  @ApiProperty({ example: 123, required: false, description: 'Filter by tag ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tagId?: number;

  // queue
  @ApiProperty({ example: 123, required: false, description: 'Filter by queue ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  queueId?: number;

  //Query
  @ApiProperty({ example: 'search text', required: false, description: 'Search filter with file name' })
  @IsOptional()
  @IsString()
  query?: string;

  // file name
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class GetMemberContactsDto extends BasePaginationDto {
  @ApiProperty({ description: 'ID of the member to fetch contacts for' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  memberId: number;
}

// contacts-summary.interface.ts
export class ContactSummary {
  @ApiProperty({ example: 1200 })
  totalContacts: number;

  @ApiProperty({ example: 950 })
  activeChats: number;

  @ApiProperty({ example: 200 })
  todayContacts: number;

  @ApiProperty({ example: 350 })
  responseRate: number;
}

