import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponse {
  @ApiProperty({ example: 400 })
  responseCode: number;

  @ApiProperty({ example: 'An error occurred' })
  message: string;

  @ApiProperty({ example: false })
  success: boolean;
}
