import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PersonalKycStatus, ProfessionalRole, ProfessionalRoleApplicationStatus } from '@prisma/client';
import { OTP_PURPOSE_EMAIL_VERIFY } from '../../common/auth.constants';
import { normalizePhoneE164 } from '../../common/phone.util';
import { ProfileCompleteDto } from '../../dto/profile-complete.dto';
import { ProfileVerifyEmailDto } from '../../dto/profile-verify-email.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RabbitmqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { OtpService } from '../auth/otp.service';
import { SessionService } from '../auth/session.service';

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly session: SessionService,
    private readonly otp: OtpService,
    private readonly rabbit: RabbitmqService,
  ) {}

  async listOperatingCountries(): Promise<Record<string, unknown>> {
    return this.rabbit.rpc<Record<string, unknown>>(
      'admin.rpc.operating-countries.list',
      {},
    );
  }

  async getMe(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(
      authorization,
      deviceIdHeader,
    );
    return {
      user: session.user,
      deviceId: session.deviceId,
      lastIp: session.lastIp,
    };
  }

  async lookupUserByPhone(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
    phoneRaw: string,
  ): Promise<Record<string, unknown>> {
    await this.session.resolveAuthenticatedSession(authorization, deviceIdHeader);
    const phone = normalizePhoneE164(phoneRaw);
    const target = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, disabled: true },
    });
    if (!target || target.disabled || !target.phone) {
      throw new NotFoundException('user not found');
    }
    return { userId: target.id, phone: target.phone };
  }

  async searchByEmailOrPhone(queryRaw?: string): Promise<Record<string, unknown>> {
    const query = queryRaw?.trim();
    if (!query) {
      throw new BadRequestException('query is required');
    }
    const target = await this.prisma.user.findFirst({
      where: {
        disabled: false,
        OR: [{ email: normalizeEmail(query) }, { phone: query }, { id: query }],
      },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
      },
    });
    if (!target) {
      throw new NotFoundException('user not found');
    }
    return target;
  }

  async searchApprovedProfessionals(
    roleRaw?: string,
    queryRaw?: string,
  ): Promise<Record<string, unknown>> {
    const role = String(roleRaw ?? '')
      .trim()
      .toUpperCase();
    if (!role) {
      throw new BadRequestException('role is required');
    }
    if (role !== ProfessionalRole.LAWYER && role !== ProfessionalRole.AGENT) {
      throw new BadRequestException('role must be LAWYER or AGENT');
    }
    const query = queryRaw?.trim() ?? '';
    const users = await this.prisma.user.findMany({
      where: {
        disabled: false,
        professionalApps: {
          some: {
            role: role as ProfessionalRole,
            status: ProfessionalRoleApplicationStatus.APPROVED,
          },
        },
        ...(query
          ? {
              OR: [
                { id: query },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
                { displayName: { contains: query, mode: 'insensitive' } },
                { fullName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        fullName: true,
        email: true,
        phone: true,
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      items: users.map((user) => ({
        id: user.id,
        displayName: user.displayName ?? user.fullName ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
      })),
    };
  }

  async currencyCountryForUser(userId?: string): Promise<Record<string, unknown>> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, countryCode: true },
    });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return { userId: user.id, countryCode: user.countryCode ?? null };
  }

  async personalKycStatus(userId?: string): Promise<Record<string, unknown>> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        personalKycApprovedAt: true,
        personalKycStatus: true,
        personalKycVersion: true,
        personalKycRejectedReason: true,
      },
    });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    const approved = user.personalKycStatus === PersonalKycStatus.APPROVED;
    return {
      userId: user.id,
      status: user.personalKycStatus,
      version: user.personalKycVersion,
      approved,
      approvedAt: user.personalKycApprovedAt?.toISOString() ?? null,
      rejectedReason: user.personalKycRejectedReason,
    };
  }

  async completeProfile(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
    dto: ProfileCompleteDto,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(
      authorization,
      deviceIdHeader,
    );
    const emailNorm = normalizeEmail(dto.email);
    const displayName = dto.displayName.trim();
    const fullName = dto.fullName.trim();

    const current = await this.prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        emailVerifiedAt: true,
        profileCompletedAt: true,
      },
    });
    if (!current) {
      throw new NotFoundException('user not found');
    }

    const taken = await this.prisma.user.findFirst({
      where: { email: emailNorm, NOT: { id: session.user.id } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('email already in use');
    }

    if (
      current.email === emailNorm &&
      current.emailVerifiedAt &&
      current.profileCompletedAt
    ) {
      await this.prisma.user.update({
        where: { id: session.user.id },
        data: { displayName, fullName },
      });
      await this.prisma.authAudit.create({
        data: {
          userId: session.user.id,
          event: 'profile_updated',
          detail: 'display name / full name',
        },
      });
      return {
        ok: true,
        profileComplete: true,
        needsEmailVerification: false,
        profileCompletedAt: current.profileCompletedAt.toISOString(),
      };
    }

    if (current.email && current.email !== emailNorm) {
      await this.prisma.otpChallenge.updateMany({
        where: {
          target: current.email,
          purpose: OTP_PURPOSE_EMAIL_VERIFY,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
    }

    await this.prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName,
        fullName,
        email: emailNorm,
        emailVerifiedAt: null,
        profileCompletedAt: null,
      },
    });
    await this.otp.sendEmailVerification(emailNorm);
    await this.prisma.authAudit.create({
      data: {
        userId: session.user.id,
        event: 'profile_email_pending',
        detail: 'verification code sent',
      },
    });
    return {
      ok: true,
      profileComplete: false,
      needsEmailVerification: true,
    };
  }

  async verifyProfileEmail(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
    dto: ProfileVerifyEmailDto,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(
      authorization,
      deviceIdHeader,
    );
    const user = await this.prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    if (!user?.email) {
      throw new BadRequestException('set email on your profile first');
    }
    await this.otp.verifyAndConsume(
      user.email,
      OTP_PURPOSE_EMAIL_VERIFY,
      dto.code,
    );
    const now = new Date();
    await this.prisma.user.update({
      where: { id: session.user.id },
      data: {
        emailVerifiedAt: now,
        profileCompletedAt: now,
      },
    });
    await this.prisma.authAudit.create({
      data: {
        userId: session.user.id,
        event: 'email_verified',
        detail: 'profile complete',
      },
    });
    return {
      ok: true,
      profileCompletedAt: now.toISOString(),
    };
  }

  async resendProfileEmailVerification(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(
      authorization,
      deviceIdHeader,
    );
    const row = await this.prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    if (!row?.email) {
      throw new BadRequestException('set email on your profile first');
    }
    return this.otp.sendEmailVerification(row.email);
  }

  async registerFcmToken(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
    fcmToken: string,
    platform?: string,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(
      authorization,
      deviceIdHeader,
    );
    const token = fcmToken.trim();
    if (!token) {
      throw new BadRequestException('fcmToken is required');
    }
    const device = await this.prisma.userDevice.findUnique({
      where: {
        userId_deviceId: {
          userId: session.user.id,
          deviceId: session.deviceId,
        },
      },
    });
    if (!device) {
      throw new NotFoundException('device session not found');
    }
    await this.prisma.userDevice.update({
      where: { id: device.id },
      data: {
        fcmToken: token,
        fcmPlatform: platform?.trim() || null,
        lastSeenAt: new Date(),
      },
    });
    this.logger.log(
      `FCM token registered for user ${session.user.id} (${platform?.trim() || 'unknown'})`,
    );
    return { ok: true };
  }

  async listPushTokensForUser(userIdRaw?: string): Promise<Record<string, unknown>> {
    const userId = userIdRaw?.trim();
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const rows = await this.prisma.userDevice.findMany({
      where: { userId, fcmToken: { not: null } },
      select: { fcmToken: true, fcmPlatform: true, deviceId: true },
    });
    return {
      items: rows
        .filter((row) => typeof row.fcmToken === 'string' && row.fcmToken.length > 0)
        .map((row) => ({
          token: row.fcmToken as string,
          platform: row.fcmPlatform,
          deviceId: row.deviceId,
        })),
    };
  }
}
