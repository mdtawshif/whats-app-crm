import {
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError): any {
    switch (exception.code) {
      case 'P2002': {
        throw new ConflictException('Not Unique Email');
      }
      case 'P2003': {
        throw new UnprocessableEntityException('Entity Not Exist');
      }
      case 'P2025': {
        throw new NotFoundException('Cannot find');
      }
      default:
        break;
    }
    return exception;
  }
}

export function handlePrismaError(error: any): any {
  // if (error instanceof Prisma.PrismaClientKnownRequestError) {
  // Known Prisma error (e.g., P2002: Unique constraint failed)
  console.log('error', error);
  return {
    message:
      error.meta?.message || error?.message || `Prisma error: ${error.name}`,
    extensions: {
      code: 'PRISMA_ERROR',
      prismaCode: error.code, // Prisma error code
      meta: error.meta,
      // Additional metadata from Prisma error
    },
  };
  // }
}
