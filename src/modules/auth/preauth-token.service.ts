import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PreAuthFlow } from '../../common/auth.constants';
import { PREAUTH_TTL_MS } from '../../common/auth.constants';

type Payload = {
  phone: string;
  flow: PreAuthFlow;
  exp: number;
  v: 1;
};

@Injectable()
export class PreAuthTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    const s = config.get<string>('AUTH_PREAUTH_SECRET')?.trim();
    const prod = process.env.NODE_ENV === 'production';
    if (prod && (!s || s.length < 16)) {
      throw new Error(
        'AUTH_PREAUTH_SECRET must be set (min 16 chars) in production',
      );
    }
    this.secret =
      s && s.length >= 16
        ? s
        : 'dev-preauth-secret-min-16-chars-not-for-prod';
  }

  issue(phone: string, flow: PreAuthFlow): string {
    const payload: Payload = {
      phone,
      flow,
      exp: Date.now() + PREAUTH_TTL_MS,
      v: 1,
    };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verify(token: string): Payload {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('invalid pre-auth token');
    }
    const [body, sig] = parts;
    const expected = createHmac('sha256', this.secret)
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('invalid pre-auth token');
    }
    let parsed: Payload;
    try {
      parsed = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as Payload;
    } catch {
      throw new UnauthorizedException('invalid pre-auth token');
    }
    if (parsed.v !== 1 || !parsed.phone || !parsed.flow) {
      throw new UnauthorizedException('invalid pre-auth token');
    }
    if (parsed.exp < Date.now()) {
      throw new UnauthorizedException('pre-auth token expired');
    }
    return parsed;
  }
}
