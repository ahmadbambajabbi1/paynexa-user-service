import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OTP_PURPOSE_PHONE_AUTH } from '../../common/auth.constants';
import { normalizePhoneE164 } from '../../common/phone.util';
import { assertValidPin, hashPin } from '../../common/pin.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RabbitmqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { OtpService } from './otp.service';
import { PreAuthTokenService } from './preauth-token.service';
import { SessionService } from './session.service';

@Injectable()
export class PhoneAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly preAuth: PreAuthTokenService,
    private readonly session: SessionService,
    private readonly rabbit: RabbitmqService,
  ) {}

  async sendCode(
    rawPhone: string,
    countryCode?: string,
  ): Promise<Record<string, unknown>> {
    const phone = normalizePhoneE164(rawPhone);
    if (countryCode) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { countryCode },
        });
      }
    }
    return this.otp.sendPhoneAuth(phone);
  }

  async verifySmsAndIssuePreAuth(
    rawPhone: string,
    code: string,
  ): Promise<Record<string, unknown>> {
    const phone = normalizePhoneE164(rawPhone);
    await this.otp.verifyAndConsume(phone, OTP_PURPOSE_PHONE_AUTH, code);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    const flow = user?.pinHash ? 'enter_pin' : 'set_pin';
    const preAuthToken = this.preAuth.issue(phone, flow);
    return {
      nextStep: flow,
      preAuthToken,
      hasAccount: Boolean(user),
    };
  }

  async setPinAndCreateSession(
    preAuthToken: string,
    pin: string,
    deviceId: string,
    macAddress: string | undefined,
    countryCode: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<Record<string, unknown>> {
    const payload = this.preAuth.verify(preAuthToken);
    if (payload.flow !== 'set_pin') {
      throw new BadRequestException('invalid step: expected set_pin');
    }
    assertValidPin(pin);
    const phone = payload.phone;
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.pinHash) {
      throw new ConflictException('PIN already set for this phone');
    }
    const pinDigest = hashPin(pin);
    let user: {
      id: string;
      profileCompletedAt: Date | null;
      emailVerifiedAt: Date | null;
    };
    try {
      if (existing) {
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            pinHash: pinDigest,
            ...(countryCode ? { countryCode } : {}),
            authAudits: {
              create: {
                event: 'pin_set_phone',
                detail: 'existing account',
                ipAddress,
              },
            },
          },
          select: { id: true, profileCompletedAt: true, emailVerifiedAt: true },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            phone,
            email: null,
            countryCode: countryCode ?? null,
            pinHash: pinDigest,
            authAudits: {
              create: {
                event: 'register_phone',
                detail: 'phone + pin',
                ipAddress,
              },
            },
          },
          select: { id: true, profileCompletedAt: true, emailVerifiedAt: true },
        });
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('phone already registered');
      }
      throw e;
    }
    const sess = await this.session.issueDeviceSession(
      user.id,
      deviceId,
      macAddress,
      ipAddress,
      userAgent,
      'phone_pin_register',
    );
    await this.rabbit.publish('user.created', {
      userId: user.id,
      phone,
      profileCompleted: Boolean(user.profileCompletedAt),
      occurredAt: new Date().toISOString(),
    });
    return {
      token: sess.token,
      deviceId,
      userId: user.id,
      profileCompleted: Boolean(user.profileCompletedAt),
    };
  }

  async verifyPinAndCreateSession(
    preAuthToken: string,
    pin: string,
    deviceId: string,
    macAddress: string | undefined,
    countryCode: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<Record<string, unknown>> {
    const payload = this.preAuth.verify(preAuthToken);
    if (payload.flow !== 'enter_pin') {
      throw new BadRequestException('invalid step: expected enter_pin');
    }
    assertValidPin(pin);
    const phone = payload.phone;
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.pinHash) {
      throw new UnauthorizedException('invalid credentials');
    }
    if (user.disabled) {
      await this.prisma.authAudit.create({
        data: {
          userId: user.id,
          event: 'login_blocked_disabled',
          detail: 'phone pin login',
          ipAddress,
        },
      });
      throw new UnauthorizedException('account disabled');
    }
    if (hashPin(pin) !== user.pinHash) {
      await this.prisma.authAudit.create({
        data: {
          userId: user.id,
          event: 'failed_login',
          detail: 'invalid pin',
          ipAddress,
        },
      });
      throw new UnauthorizedException('invalid credentials');
    }
    if (countryCode) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { countryCode },
      });
    }
    const sess = await this.session.issueDeviceSession(
      user.id,
      deviceId,
      macAddress,
      ipAddress,
      userAgent,
      'phone_pin_login',
    );
    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { profileCompletedAt: true, emailVerifiedAt: true },
    });
    return {
      token: sess.token,
      deviceId,
      userId: user.id,
      profileCompleted: Boolean(fresh?.profileCompletedAt),
    };
  }
}
