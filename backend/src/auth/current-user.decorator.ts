import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest, JwtPayload } from './jwt-auth.guard';

/** Injects the authenticated user (JWT payload) into a route handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.user;
  },
);
