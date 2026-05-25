import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async issueDeviceSession(
    userId: string,
    deviceId: string,
    macAddress: string | undefined,
    ipAddress: string,
    userAgent: string,
    auditEvent: string,
  ): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    if (user.disabled) {
      throw new ForbiddenException('account disabled');
    }
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const existing = await this.prisma.userDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });
    if (existing) {
      await this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          tokenHash,
          ipAddress,
          userAgent,
          macAddress,
          lastSeenAt: new Date(),
        },
      });
      await this.prisma.authAudit.create({
        data: {
          userId,
          event: auditEvent,
          detail: `device=${deviceId}`,
          ipAddress,
        },
      });
    } else {
      await this.prisma.userDevice.create({
        data: {
          userId,
          deviceId,
          ipAddress,
          macAddress,
          userAgent,
          tokenHash,
        },
      });
      await this.prisma.authAudit.create({
        data: {
          userId,
          event: 'new_device_login',
          detail: `device=${deviceId}`,
          ipAddress,
        },
      });
    }
    return { token: rawToken };
  }

  async resolveAuthenticatedSession(
    authorization: string | undefined,
    deviceIdHeader: string | undefined,
  ): Promise<{
    deviceId: string;
    lastIp: string;
    user: {
      id: string;
      phone: string | null;
      countryCode: string | null;
      email: string | null;
      emailVerifiedAt: Date | null;
      displayName: string | null;
      fullName: string | null;
      profileCompletedAt: Date | null;
      personalKycApprovedAt: Date | null;
      personalKycStatus: string;
      personalKycVersion: number;
      personalKycRejectedReason: string | null;
      createdAt: Date;
      professionalApps: Array<{
        id: string;
        role: string;
        status: string;
        createdAt: Date;
      }>;
    };
  }> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }
    if (!deviceIdHeader) {
      throw new UnauthorizedException('missing X-Device-Id');
    }
    const token = authorization.slice('Bearer '.length).trim();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const device = await this.prisma.userDevice.findFirst({
      where: { tokenHash, deviceId: deviceIdHeader },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            countryCode: true,
            email: true,
            emailVerifiedAt: true,
            displayName: true,
            fullName: true,
            profileCompletedAt: true,
            personalKycApprovedAt: true,
            personalKycStatus: true,
            personalKycVersion: true,
            personalKycRejectedReason: true,
            disabled: true,
            createdAt: true,
            professionalApps: {
              select: { id: true, role: true, status: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!device) {
      throw new UnauthorizedException('invalid session');
    }
    if (device.user.disabled) {
      throw new UnauthorizedException('invalid session');
    }
    await this.prisma.userDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    const { disabled, ...user } = device.user;
    void disabled;
    return {
      user,
      deviceId: device.deviceId,
      lastIp: device.ipAddress,
    };
  }
}
