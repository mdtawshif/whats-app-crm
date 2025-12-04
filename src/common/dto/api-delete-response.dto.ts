import { ApiProperty } from '@nestjs/swagger';

export class ApiDeleteResponseDto {
    @ApiProperty({ description: 'Status code of the response', example: 200 })
    statusCode: number;

    @ApiProperty({ description: 'Response message', example: 'Broadcast deleted successfully' })
    message: string;

    @ApiProperty({ description: 'Optional deleted entity ID', example: 123, required: false })
    deletedId?: number;
}
