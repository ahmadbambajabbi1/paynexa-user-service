import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { SessionCacheService } from './session-cache.service';

type SessionEventPayload = {
  deviceId?: string;
  tokenHash?: string;
  userId?: string;
};

@Injectable()
export class SessionCacheListener implements OnModuleInit {
  private readonly logger = new Logger(SessionCacheListener.name);

  constructor(
    private readonly rabbit: RabbitmqService,
    private readonly cache: SessionCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbit.consume(
      'safetrade.session-cache.user',
      ['session.created', 'session.revoked'],
      async (routingKey, body) => {
        const payload = body as SessionEventPayload;
        if (!payload.deviceId || !payload.tokenHash) {
          return;
        }
        if (routingKey === 'session.created' && payload.userId) {
          await this.cache.put(payload.deviceId, payload.tokenHash, payload.userId);
          return;
        }
        if (routingKey === 'session.revoked') {
          await this.cache.revoke(payload.deviceId, payload.tokenHash);
        }
      },
    );
    this.logger.log('Session cache listener ready');
  }
}
