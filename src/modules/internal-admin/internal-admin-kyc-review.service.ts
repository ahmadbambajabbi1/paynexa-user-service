import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProfessionalRole,
  ProfessionalRoleApplicationStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { R2KycUploadService } from '../../infrastructure/r2/r2-kyc-upload.service';

const REVIEWABLE: ProfessionalRoleApplicationStatus[] = [
  ProfessionalRoleApplicationStatus.SUBMITTED,
  ProfessionalRoleApplicationStatus.UNDER_REVIEW,
];

@Injectable()
export class InternalAdminKycReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Kyc: R2KycUploadService,
  ) {}

  async listApplications() {
    const rows = await this.prisma.professionalRoleApplication.findMany({
      where: {
        role: { in: [ProfessionalRole.LAWYER, ProfessionalRole.AGENT] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            displayName: true,
            fullName: true,
          },
        },
        kycDocs: {
          select: { id: true, kind: true, uploader: true, createdAt: true },
        },
      },
    });
    return {
      applications: rows.map((r) => ({
        id: r.id,
        role: r.role,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        user: r.user,
        kycDocumentCount: r.kycDocs.length,
        hasSelfie: r.kycDocs.some((d) => d.uploader.toLowerCase().includes('selfie')),
      })),
    };
  }

  async getApplicationDetail(id: string) {
    const row = await this.prisma.professionalRoleApplication.findFirst({
      where: {
        id,
        role: { in: [ProfessionalRole.LAWYER, ProfessionalRole.AGENT] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            displayName: true,
            fullName: true,
            countryCode: true,
          },
        },
        kycDocs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('application not found');
    }
    const docs = await Promise.all(
      row.kycDocs.map(async (d) => ({
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
        id: row.id,
        role: row.role,
        status: row.status,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        user: row.user,
        kycDocuments: docs,
      },
    };
  }

  async approve(id: string) {
    const row = await this.requireReviewable(id);
    const selfie = await this.prisma.kycDocument.findFirst({
      where: {
        professionalApplicationId: row.id,
        uploader: {
          contains: 'selfie',
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    if (!selfie) {
      throw new BadRequestException(
        'Selfie verification photo is required before approval',
      );
    }
    await this.prisma.professionalRoleApplication.update({
      where: { id: row.id },
      data: { status: ProfessionalRoleApplicationStatus.APPROVED },
    });
    await this.prisma.authAudit.create({
      data: {
        userId: row.userId,
        event: 'professional_role_approved',
        detail: `application=${row.id} role=${row.role}`,
      },
    });
    return { ok: true, status: ProfessionalRoleApplicationStatus.APPROVED };
  }

  async reject(id: string, reason?: string) {
    const row = await this.requireReviewable(id);
    const prev =
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    await this.prisma.professionalRoleApplication.update({
      where: { id: row.id },
      data: {
        status: ProfessionalRoleApplicationStatus.REJECTED,
        payload: {
          ...prev,
          adminRejectionReason: reason?.trim() || undefined,
          adminRejectedAt: new Date().toISOString(),
        },
      },
    });
    await this.prisma.authAudit.create({
      data: {
        userId: row.userId,
        event: 'professional_role_rejected',
        detail: `application=${row.id} role=${row.role}`,
      },
    });
    return { ok: true, status: ProfessionalRoleApplicationStatus.REJECTED };
  }

  private async requireReviewable(id: string) {
    const row = await this.prisma.professionalRoleApplication.findFirst({
      where: {
        id,
        role: { in: [ProfessionalRole.LAWYER, ProfessionalRole.AGENT] },
      },
    });
    if (!row) {
      throw new NotFoundException('application not found');
    }
    if (!REVIEWABLE.includes(row.status)) {
      throw new BadRequestException('application is not awaiting review');
    }
    return row;
  }
}
