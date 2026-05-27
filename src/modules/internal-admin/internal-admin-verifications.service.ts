import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type VerificationRow = {
  id: string;
  target: string;
  channel: string;
  purpose: string;
  code: string | null;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
  createdAt: Date;
  userId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userDisplayName: string | null;
  userFullName: string | null;
};

@Injectable()
export class InternalAdminVerificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(limit = 100): Promise<{ verifications: unknown[] }> {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 250);
    const rows = await this.prisma.$queryRaw<VerificationRow[]>`
      SELECT
        o."id",
        o."target",
        o."channel",
        o."purpose",
        o."plainCode" AS "code",
        o."expiresAt",
        o."attemptCount",
        o."consumedAt",
        o."createdAt",
        u."id" AS "userId",
        u."email" AS "userEmail",
        u."phone" AS "userPhone",
        u."displayName" AS "userDisplayName",
        u."fullName" AS "userFullName"
      FROM "OtpChallenge" o
      LEFT JOIN "User" u ON u."email" = o."target" OR u."phone" = o."target"
      ORDER BY o."createdAt" DESC
      LIMIT ${take}
    `;

    return {
      verifications: rows.map((row) => ({
        id: row.id,
        target: row.target,
        channel: row.channel,
        medium: row.channel === 'EMAIL' ? 'email' : 'phone',
        purpose: row.purpose,
        code: row.code,
        expiresAt: row.expiresAt.toISOString(),
        attemptCount: row.attemptCount,
        consumedAt: row.consumedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.userId
          ? {
              id: row.userId,
              email: row.userEmail,
              phone: row.userPhone,
              displayName: row.userDisplayName,
              fullName: row.userFullName,
            }
          : null,
      })),
    };
  }
}
