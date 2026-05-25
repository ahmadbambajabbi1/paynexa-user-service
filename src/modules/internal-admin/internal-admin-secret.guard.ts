import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class InternalAdminSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected =
      process.env.USER_SERVICE_INTERNAL_ADMIN_SECRET?.trim() ||
      process.env.INTERNAL_API_SECRET?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('Internal admin integration is not configured');
    }
    const provided = String(req.headers['x-user-service-admin-secret'] ?? '').trim();
    const a = createHash('sha256').update(provided, 'utf8').digest();
    const b = createHash('sha256').update(expected, 'utf8').digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
