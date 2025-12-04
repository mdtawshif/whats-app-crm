import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

import { FastifyReply, FastifyRequest } from 'fastify';
import { TranslationService } from '../translation.service';
import { handlePrismaError } from './prisma-exception.filter';

@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  private language;
  constructor(private readonly translationService: TranslationService) {}
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const status = exception?.status || 500;

    let errorObject = null;

    this.language = request?.headers['accept-language']?.split('-')[0] || 'en';
    if (this.checkIfPrismaError(exception?.name)) {
      const prismaFormattedError = handlePrismaError(exception);

      reply.code(prismaFormattedError?.code || 500).send({
        responseCode: prismaFormattedError?.code || 500,
        message: prismaFormattedError?.message,
        path: request.url,
        success: false,
      });
    }

    if (process.env.APP_ENVIRONMENT === 'development') {
      console.warn('Error2:', JSON.stringify(exception, null, 2));
    }

    let errorMessage = null;
    if (
      exception.response?.responseCode === 4001 ||
      exception.response?.message
    ) {
      errorMessage = this.translationService.translate(
        exception.response?.responseCode === 4001
          ? 'UNAUTHORIZED'
          : exception?.response?.message,
        this.language,
      );
    }

    console.log('exception?.response?.message', exception?.response);
    errorObject = {
      message:
        errorMessage ||
        this.translationService.translate(
          exception?.response?.message || exception?.response,
          this.language,
        ) ||
        this.translationService.translate(exception?.message, this.language) ||
        exception?.message,
      status_code: this.getGraphQlCodeToStatusCode(exception.response?.code),
      extensions: {
        code: exception.error || exception.status || 'INTERNAL_SERVER_ERROR',
        exception: exception.response || null,
        details: exception.response?.details || exception?.message,
        stacktrace:
          process.env.APP_ENVIRONMENT === 'development'
            ? exception.extensions?.stacktrace
            : undefined,
      },
    };

    // console.log("errorObject", errorObject);

    reply.code(status).send({
      responseCode: status,
      message: errorObject?.message,
      path: request.url,
      success: false,
    });
  }

  private checkIfPrismaError(name: string): boolean {
    const prismaErrors = [
      'PrismaClientKnownRequestError',
      'PrismaClientUnknownRequestError',
      'PrismaClientRustPanicError',
      'PrismaClientInitializationError',
      'PrismaClientValidationError',
      'PrismaClientKnownError',
    ];
    if (prismaErrors.includes(name)) {
      return true;
    }
    return false;
  }
  private getGraphQlCodeToStatusCode = (code: string): number => {
    const codeStatusMap: Record<string, number> = {
      P2002: 409,
      P2003: 404,
      P2025: 404,
      PRISMA_ERROR: 500,
      INTERNAL_SERVER_ERROR: 500,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      UNPROCESSABLE_ENTITY: 422,
      TOO_MANY_REQUESTS: 429,
      BAD_REQUEST: 400,
      CONFLICT: 409,
      BAD_USER_INPUT: 400,
      INVALID_CREDENTIALS: 401,
      INVALID_LOGIN_CREDENTIALS: 401,
      LOGIN_FAILED: 401,
      INVALID_PARAMETER: 400,
      MISSING_PARAMETER: 400,
    };

    return codeStatusMap[code] || 500;
  };
}
