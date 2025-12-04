import { ApiProperty } from '@nestjs/swagger';

export class ApiViewResponseDto<T> { 
  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: 'Resource created successfully' })
  message: string;

  @ApiProperty({ type: Object, required: false })
  data?: T;
}
