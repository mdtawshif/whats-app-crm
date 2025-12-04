import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import * as useragent from 'useragent';

export const RequestInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    try {
      const request = ctx.switchToHttp().getRequest();
      const agent = useragent.parse(request.headers['user-agent']);
      const forwardedFor = request.headers['x-forwarded-for'];

      // Extract the public IP address from x-forwarded-for header
      const x_real_ip = request.headers['x-real-ip'];
      const x_forwarded_ip = forwardedFor
        ? Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : null
        : null;

      const ip = x_forwarded_ip ? x_forwarded_ip : x_real_ip || request.ip;

      return {
        ip,
        x_real_ip,
        x_forwarded_ip,
        request_ip: request.ip,
        user_agent: request.headers['user-agent'],
        browser: agent.family,
        os: agent.os.toString(),
        device: agent.device.toString(),
      };
    } catch (error) {
      return {};
    }
  },
);
