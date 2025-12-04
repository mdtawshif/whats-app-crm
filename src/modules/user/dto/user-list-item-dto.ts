import { ApiProperty } from '@nestjs/swagger';
import { IsMailVerified, UserStatus } from '@prisma/client';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class UserListParamDto extends BasePaginationDto {

}

/**
 * Lightweight DTO for listing users.
 * Excludes sensitive fields (password, apiKey, rawPassword, masks, etc.)
 */
export class UserListItemDto {

    @ApiProperty({ type: String, example: '123', description: 'User ID (BigInt as string in docs)' })
    id: bigint;

    @ApiProperty({ example: 'Jane Doe', required: false })
    userName?: string | null;

    @ApiProperty({ example: 'jane@example.com' })
    email: string;

    @ApiProperty({ example: '+15551234567', required: false })
    phone?: string | null;

    @ApiProperty({ enum: IsMailVerified, example: IsMailVerified.YES })
    isMailVerified: IsMailVerified;

    @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
    status: UserStatus;


}
