import { BasePaginationDto } from "@/common/dto/base-pagination.dto";
import { ApiProperty } from "@nestjs/swagger";
import { ActivityAction, ActivityCategory } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { CommonFilterDto } from "src/modules/common/dto/common-filter.dto";

export class GetReportDto {
    @ApiProperty()
    @IsNotEmpty()
    startDate: Date;

    @ApiProperty()
    @IsNotEmpty()
    endDate: Date;
}

export class GetBroadcastReportDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    broadcastId: number;

    @ApiProperty()
    @IsNotEmpty()
    @IsDate()
    startDate: Date;

    @ApiProperty()
    @IsNotEmpty()
    @IsDate()
    endDate: Date;
}

export class ActivityFilterDto extends BasePaginationDto {
  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  status?: string

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  category?: string

  @ApiProperty({ required: false })
  @IsOptional() 
  @IsString()
  action?: string

  @ApiProperty()
  @IsNotEmpty() 
  @IsString()
  startDate?: string // 'YYYY-MM-DD' or ISO

  @ApiProperty()  
  @IsNotEmpty() 
  @IsString()
  endDate?: string
}

export class ActivityListItemDto {
  id: number
  userId: number
  agencyId: number
  category: string
  action: string
  description?: string
  meta?: any
  contactId?: number
  tagId?: number
  segmentId?: number
  triggerId?: number
  broadcastId?: number
  messageTemplateId?: number
  customFieldId?: number
  waBusinessNumberId?: number
  waBusinessAccountId?: number
  fbBusinessAccountId?: number
  userSettingId?: number
  personalizationId?: number
  createdAt: Date
}
