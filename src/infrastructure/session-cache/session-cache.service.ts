import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

const SESSION_TTL_SEC = 60 * 60 * 24 * 90;
const KEY_PREFIX = 'paynexa:session:';

export type CachedSession = {
  userId: string;
};

@Injectable()
export class SessionCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCacheService.name);
  private client?: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.logger.warn('REDIS_URL not set; session cache disabled');
      return;
    }
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      await this.client.connect();
      this.logger.log('Connected to Redis for session cache');
    } catch (error) {
      this.logger.error('Redis connection failed', error as Error);
      this.client = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }

  static hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  private key(deviceId: string, tokenHash: string): string {
    return `${KEY_PREFIX}${deviceId.trim()}:${tokenHash}`;
  }

  async put(deviceId: string, tokenHash: string, userId: string): Promise<void> {
    if (!this.client) return;
    await this.client.setex(
      this.key(deviceId, tokenHash),
      SESSION_TTL_SEC,
      JSON.stringify({ userId } satisfies CachedSession),
    );
  }

  async revoke(deviceId: string, tokenHash: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(this.key(deviceId, tokenHash));
  }

  async get(deviceId: string, tokenHash: string): Promise<CachedSession | null> {
    if (!this.client) return null;
    const raw = await this.client.get(this.key(deviceId, tokenHash));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedSession;
    } catch {
      return null;
    }
  }

  async resolveUserId(
    authorization: string | undefined,
    deviceId: string | undefined,
  ): Promise<string | null> {
    if (!authorization?.startsWith('Bearer ') || !deviceId?.trim()) {
      return null;
    }
    const token = authorization.slice('Bearer '.length).trim();
    const cached = await this.get(deviceId, SessionCacheService.hashToken(token));
    return cached?.userId ?? null;
  }
}
