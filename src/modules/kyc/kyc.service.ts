import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycKind, PersonalKycStatus, ProfessionalRole } from '@prisma/client';
import { KycSubmitDto } from '../../dto/kyc-submit.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RabbitmqService } from '../../infrastructure/rabbitmq/rabbitmq.service';

function mapKycKind(raw: string | undefined): KycKind {
  const upper = (raw ?? 'PERSONAL').toUpperCase();
  if (!(upper in KycKind)) {
    throw new BadRequestException(`invalid kyc kind: ${raw}`);
  }
  return KycKind[upper as keyof typeof KycKind];
}

function mapProfessionalRole(raw: string): ProfessionalRole {
  const upper = raw.toUpperCase();
  if (!(upper in ProfessionalRole)) {
    throw new BadRequestException(`invalid professional role: ${raw}`);
  }
  return ProfessionalRole[upper as keyof typeof ProfessionalRole];
}

function professionalRoleMatchesKind(
  role: ProfessionalRole,
  kind: KycKind,
): boolean {
  if (kind === KycKind.PERSONAL) {
    return false;
  }
  return role === (kind as unknown as ProfessionalRole);
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitmqService,
  ) {}

  async submitKyc(userId: string, dto: KycSubmitDto): Promise<Record<string, unknown>> {
    const kind = mapKycKind(dto.kind);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    if (user.disabled) {
      throw new ForbiddenException('account disabled');
    }
    let professionalApplicationId: string | null = null;
    if (kind === KycKind.PERSONAL) {
      if (dto.professionalApplicationId) {
        throw new BadRequestException('personal kyc must not reference an application');
      }
    } else {
      if (!dto.professionalApplicationId) {
        throw new BadRequestException(
          'lawyer, agent, and verifier kyc require professionalApplicationId',
        );
      }
      const application = await this.prisma.professionalRoleApplication.findFirst({
        where: {
          id: dto.professionalApplicationId,
          userId,
        },
      });
      if (!application) {
        throw new NotFoundException('professional application not found');
      }
      if (!professionalRoleMatchesKind(application.role, kind)) {
        throw new BadRequestException('application role does not match kyc kind');
      }
      professionalApplicationId = application.id;
    }
    if (kind === KycKind.PERSONAL) {
      if (user.personalKycStatus === PersonalKycStatus.APPROVED) {
        throw new BadRequestException('Personal KYC is already approved');
      }
      if (
        user.personalKycStatus === PersonalKycStatus.NONE ||
        user.personalKycStatus === PersonalKycStatus.REJECTED
      ) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            personalKycStatus: PersonalKycStatus.PENDING,
            personalKycVersion: { increment: 1 },
            personalKycApprovedAt: null,
            personalKycRejectedReason: null,
            personalKycPendingSince: new Date(),
          },
        });
      }
    }

    const document = await this.prisma.kycDocument.create({
      data: {
        userId,
        kind,
        professionalApplicationId,
        fileUrl: dto.fileUrl,
        fileKey: dto.fileKey,
        uploader: dto.uploader,
      },
    });
    await this.prisma.authAudit.create({
      data: {
        userId,
        event: 'kyc_submitted',
        detail: `fileKey=${dto.fileKey} kind=${kind}`,
      },
    });
    await this.rabbit.publish('kyc.submitted', {
      userId,
      kind,
      fileKey: dto.fileKey,
      fileUrl: dto.fileUrl,
      uploader: dto.uploader,
      professionalApplicationId,
      occurredAt: document.createdAt.toISOString(),
    });
    return {
      status: 'submitted',
      event: 'kyc.submitted',
      document: {
        id: document.id,
        kind: document.kind,
        fileUrl: document.fileUrl,
        fileKey: document.fileKey,
        uploader: document.uploader,
        professionalApplicationId: document.professionalApplicationId,
        timestamp: document.createdAt.toISOString(),
      },
    };
  }
}
