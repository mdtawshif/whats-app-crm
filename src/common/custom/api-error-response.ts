import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponse } from './error-api-response.dto';

export function ApiErrorResponse(
  statusCode: number = 400,
  description: string = 'Error Response',
) {
  return applyDecorators(
    ApiResponse({
      status: statusCode,
      description,
      type: ErrorResponse,
      schema: {
        properties: {
          responseCode: { type: 'number', example: statusCode },
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: description },
        },
      },
    }),
  );
}
