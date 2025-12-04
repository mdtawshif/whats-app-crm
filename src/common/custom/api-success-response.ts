import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { SuccessApiResponse } from './success-api-response.dto';

export function ApiSuccessResponse<T>(
  data: SuccessApiResponse,
): MethodDecorator {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Success response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              responseCode: {
                type: 'integer',
                example: data.responseCode || 200,
              },
              message: { type: 'string', example: data.message || 'success' },
              data: {
                type: 'object' || 'array',
                properties: {},
                example: data.data,
              },
              extraData: {
                type: 'object',
                properties: {},
                example: data.extraData,
              },
            },
          },
        },
      },
    }),
  );
}
