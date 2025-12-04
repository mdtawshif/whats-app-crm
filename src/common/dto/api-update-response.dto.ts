import { ApiProperty } from '@nestjs/swagger';

export class ApiUpdateResponseDto<T> {
    @ApiProperty({ example: 200 })
    statusCode: number;

    @ApiProperty({ example: 'Resource updated successfully' })
    message: string;

    @ApiProperty({ type: Object })
    data?: T;
}
