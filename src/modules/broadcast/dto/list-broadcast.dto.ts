
import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';
export class BroadCastListParamDto extends BasePaginationDto {

}


export class BroadcastListItemDto {

    @ApiProperty()
    id: bigint;

    @ApiProperty({ required: true })
    title: string;

    @ApiProperty({ required: true })
    wabaId!: string;

    @ApiProperty()
    agencyId: bigint;

    @ApiProperty({ required: false })
    createdBy?: bigint;

    @ApiProperty()
    userId: bigint;

    @ApiProperty()
    status: string; // You can map BroadcastStatus enum here

    @ApiProperty({ required: false })
    createdAt?: Date;

    @ApiProperty({ required: false })
    startedAt?: Date;

    @ApiProperty({ required: false })
    pausedAt?: Date;

    @ApiProperty({ required: false })
    errorMessage?: string;

    @ApiProperty()
    totalContacted: number;

    @ApiProperty()
    rescheduleDueToRateLimit: boolean;

}
