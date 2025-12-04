import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, map, Observable, throwError } from 'rxjs';
import { TranslationService } from '../translation.service';
import type { FastifyReply } from 'fastify';

@Injectable()
export class ResponseFormatInterceptor implements NestInterceptor {
  private language: string;

  constructor(private readonly translationService: TranslationService) { }

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    let response: FastifyReply

    if (context.getType() === 'http') {
      response = context.switchToHttp().getResponse();
      const request = context.switchToHttp().getRequest();
      this.language =
        request?.headers['accept-language']?.split('-')[0] || 'en';
    } else if (context.getType().toString() === 'graphql') {
      const gqlContext = context.getArgs()[2];
      const request = gqlContext?.req;
      response = gqlContext?.res;
      this.language =
        request?.headers['accept-language']?.split('-')[0] || 'en';
    }

    return next.handle().pipe(
      map((data) => {
        if (typeof data !== 'object' || Array.isArray(data)) {
          return data;
        }

        // 🔹 Set HTTP status if responseCode exists
        if (data?.responseCode && response) {
          response.status(data.responseCode);
        }

        return {
          ...data,
          responseCode: data?.responseCode ?? 200,
          success: data?.success ?? true,
          message:
            this.translationService.translate(data?.message, this.language) ||
            data?.message,
        };
      }),
      catchError((error) => {
        // If the error itself has a responseCode, set status here
        if (error?.response?.responseCode && response) {
          response.status(error.response.responseCode);
        }
        return throwError(() => error);
      }),
    );
  }
}