import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Dedicated secret for marketplace peer profile reads (service → user-service).
 * Set SERVICE_MARKETPLACE_INTERNAL_SECRET in user-service & product-service.
 */
@Injectable()
export class ServiceMarketplaceInternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected =
      process.env.SERVICE_MARKETPLACE_INTERNAL_SECRET?.trim() ||
      process.env.INTERNAL_API_SECRET?.trim() ||
      (process.env.NODE_ENV === 'production' ? '' : 'change-me');
    if (!expected) {
      throw new ServiceUnavailableException(
        'SERVICE_MARKETPLACE_INTERNAL_SECRET is not configured',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = String(
      req.headers['x-service-marketplace-internal-secret'] ?? '',
    ).trim();
    const a = createHash('sha256').update(provided, 'utf8').digest();
    const b = createHash('sha256').update(expected, 'utf8').digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
