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

  async sendPhoneAuth(targetNorm: string): Promise<Record<string, unknown>> {
    return this.issueOtp({
      targetNorm,
      channel: 'SMS',
      purpose: OTP_PURPOSE_PHONE_AUTH,
      deliver: (code) => this.sms.sendVerificationCode(targetNorm, code),
    });
  }

  /**
   * Email verification OTP — delivered via configured mail provider.
   */
  async sendEmailVerification(
    normalizedEmail: string,
  ): Promise<Record<string, unknown>> {
    return this.issueOtp({
      targetNorm: normalizedEmail,
      channel: 'EMAIL',
      purpose: OTP_PURPOSE_EMAIL_VERIFY,
      deliver: (code) => this.email.sendVerificationEmail(normalizedEmail, code),
      logEvent: 'email_otp_sent',
    });
  }

  private async issueOtp(params: {
    targetNorm: string;
    channel: 'SMS' | 'EMAIL';
    purpose: string;
    deliver: (code: string) => Promise<void>;
    logEvent?: string;
  }): Promise<Record<string, unknown>> {
    await this.prisma.otpChallenge.updateMany({
      where: {
        target: params.targetNorm,
        purpose: params.purpose,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        target: params.targetNorm,
        channel: params.channel,
        purpose: params.purpose,
        codeHash,
        plainCode: code,
        expiresAt,
      } as any,
    });
    try {
      await params.deliver(code);
    } catch (err) {
      await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
      throw err;
    }
    this.logger.log(
      JSON.stringify({
        event: params.logEvent ?? 'otp_sent',
        target: params.targetNorm,
        channel: params.channel,
        purpose: params.purpose,
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
