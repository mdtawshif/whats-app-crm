// src/common/decorators/timezone.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserTimezone {
    timezone: string;
    offset: string; // Keep as string since it's coming from header
}

export const UserTimezone = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): UserTimezone => {
        const request = ctx.switchToHttp().getRequest();
        return {
            timezone: request.headers['x-user-timezone'] || 'UTC',
            offset: request.headers['x-user-timezone-offset'] || '+00:00',
        };
    },
);