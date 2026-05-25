import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycKind, PersonalKycStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { R2KycUploadService } from '../../infrastructure/r2/r2-kyc-upload.service';

@Injectable()
export class InternalAdminPersonalKycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Kyc: R2KycUploadService,
  ) {}

  async listPending() {
    const rows = await this.prisma.user.findMany({
      where: { personalKycStatus: PersonalKycStatus.PENDING },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        fullName: true,
        personalKycVersion: true,
        personalKycPendingSince: true,
        updatedAt: true,
        _count: {
          select: {
            kycDocs: { where: { kind: KycKind.PERSONAL } },
          },
        },
      },
    });
    return {
      applications: rows.map((r) => ({
        userId: r.id,
        personalKycVersion: r.personalKycVersion,
        documentCount: r._count.kycDocs,
        pendingSince: r.personalKycPendingSince?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        user: {
          id: r.id,
          email: r.email,
          phone: r.phone,
          displayName: r.displayName,
          fullName: r.fullName,
        },
      })),
    };
  }

  async getUserDetail(userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        fullName: true,
        countryCode: true,
        personalKycStatus: true,
        personalKycVersion: true,
        personalKycPendingSince: true,
        personalKycRejectedReason: true,
        personalKycApprovedAt: true,
        kycDocs: {
          where: { kind: KycKind.PERSONAL },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('user not found');
    }
    const since = row.personalKycPendingSince;
    const docs = row.kycDocs.filter((d) => !since || d.createdAt >= since);
    const withUrls = await Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        kind: d.kind,
        uploader: d.uploader,
        fileKey: d.fileKey,
        fileUrl: d.fileUrl,
        createdAt: d.createdAt.toISOString(),
        downloadUrl: await this.r2Kyc.getSignedDownloadUrl(d.fileKey, 900),
      })),
    );
    return {
      application: {
        userId: row.id,
        status: row.personalKycStatus,
        personalKycVersion: row.personalKycVersion,
        pendingSince: row.personalKycPendingSince?.toISOString() ?? null,
        rejectedReason: row.personalKycRejectedReason,
        approvedAt: row.personalKycApprovedAt?.toISOString() ?? null,
        user: {
          id: row.id,
          email: row.email,
          phone: row.phone,
          displayName: row.displayName,
          fullName: row.fullName,
          countryCode: row.countryCode,
        },
        kycDocuments: withUrls,
      },
    };
  }

  async approve(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    if (user.personalKycStatus !== PersonalKycStatus.PENDING) {
      throw new BadRequestException('personal KYC is not pending review');
    }
    const since = user.personalKycPendingSince;
    const docs = await this.prisma.kycDocument.findMany({
      where: {
        userId,
        kind: KycKind.PERSONAL,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    });
    const u = (s: string) => s.toLowerCase();
    const hasId = docs.some(
      (d) =>
        u(d.uploader).includes('government') ||
        u(d.uploader).includes('id_card') ||
        d.uploader.includes('personal:government_id'),
    );
    const hasSelfie = docs.some((d) => u(d.uploader).includes('selfie'));
    if (!hasId || !hasSelfie) {
      throw new BadRequestException(
        'government ID and selfie documents are required before approval',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        personalKycStatus: PersonalKycStatus.APPROVED,
        personalKycApprovedAt: new Date(),
        personalKycRejectedReason: null,
        personalKycPendingSince: null,
      },
    });
    await this.prisma.authAudit.create({
      data: {
        userId,
        event: 'personal_kyc_approved',
        detail: `version=${user.personalKycVersion}`,
      },
    });
    return { ok: true, status: PersonalKycStatus.APPROVED };
  }

  async reject(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    if (user.personalKycStatus !== PersonalKycStatus.PENDING) {
      throw new BadRequestException('personal KYC is not pending review');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        personalKycStatus: PersonalKycStatus.REJECTED,
        personalKycRejectedReason: reason?.trim() || null,
        personalKycApprovedAt: null,
        personalKycPendingSince: null,
      },
    });
    await this.prisma.authAudit.create({
      data: {
        userId,
        event: 'personal_kyc_rejected',
        detail: `version=${user.personalKycVersion}`,
      },
    });
    return { ok: true, status: PersonalKycStatus.REJECTED };
  }
}
