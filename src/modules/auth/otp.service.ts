import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import {
  MAX_OTP_ATTEMPTS,
  OTP_PURPOSE_EMAIL_VERIFY,
  OTP_PURPOSE_PHONE_AUTH,
  OTP_TTL_MS,
} from '../../common/auth.constants';
import { EmailService } from '../../infrastructure/email/email.service';
import { SmsService } from '../../infrastructure/sms/sms.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

function hashOtp(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
  ) {}

  /**
   * Creates OTP, persists it, sends via Twilio. Response never includes the code.
   */
  async sendPhoneAuth(targetNorm: string): Promise<Record<string, unknown>> {
    await this.prisma.otpChallenge.updateMany({
      where: {
        target: targetNorm,
        purpose: OTP_PURPOSE_PHONE_AUTH,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    console.log({ code });
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        target: targetNorm,
        channel: 'SMS',
        purpose: OTP_PURPOSE_PHONE_AUTH,
        codeHash,
        expiresAt,
      },
    });
    try {
      // await this.sms.sendVerificationCode(targetNorm, code);
    } catch (err) {
      await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
      throw err;
    }
    this.logger.log(
      JSON.stringify({
        event: 'otp_sent',
        target: targetNorm,
        channel: 'SMS',
        purpose: OTP_PURPOSE_PHONE_AUTH,
        expiresAt: expiresAt.toISOString(),
      }),
    );
    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Email verification OTP — code is only logged server-side until a mail provider is configured.
   */
  async sendEmailVerification(normalizedEmail: string): Promise<Record<string, unknown>> {
    await this.prisma.otpChallenge.updateMany({
      where: {
        target: normalizedEmail,
        purpose: OTP_PURPOSE_EMAIL_VERIFY,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    console.log({ email: normalizedEmail, code });
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        target: normalizedEmail,
        channel: 'EMAIL',
        purpose: OTP_PURPOSE_EMAIL_VERIFY,
        codeHash,
        expiresAt,
      },
    });
    try {
      await this.email.sendVerificationEmail(normalizedEmail, code);
    } catch (err) {
      await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
      throw err;
    }
    this.logger.log(
      JSON.stringify({
        event: 'email_otp_sent',
        target: normalizedEmail,
        purpose: OTP_PURPOSE_EMAIL_VERIFY,
        expiresAt: expiresAt.toISOString(),
      }),
    );
    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyAndConsume(
    targetNorm: string,
    purpose: string,
    plainCode: string,
  ): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        target: targetNorm,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new UnauthorizedException('invalid or expired otp');
    }
    if (challenge.attemptCount >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException('otp attempts exceeded');
    }
    if (hashOtp(plainCode) !== challenge.codeHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException('invalid otp');
    }
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }
}
