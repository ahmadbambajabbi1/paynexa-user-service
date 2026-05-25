import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProfessionalRole,
  ProfessionalRoleApplicationStatus,
} from '@prisma/client';
import { ProfessionalApplyDto } from '../../dto/professional-apply.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

function mapProfessionalRole(raw: string): ProfessionalRole {
  const upper = raw.toUpperCase();
  if (!(upper in ProfessionalRole)) {
    throw new BadRequestException(`invalid professional role: ${raw}`);
  }
  return ProfessionalRole[upper as keyof typeof ProfessionalRole];
}

@Injectable()
export class ProfessionalService {
  constructor(private readonly prisma: PrismaService) {}

  async applyProfessionalRole(
    userId: string,
    dto: ProfessionalApplyDto,
  ): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    if (user.disabled) {
      throw new ForbiddenException('account disabled');
    }
    const role = mapProfessionalRole(dto.role);
    const otherRoleApplication = await this.prisma.professionalRoleApplication.findFirst({
      where: {
        userId: user.id,
        role: {
          not: role,
        },
      },
    });
    if (otherRoleApplication) {
      throw new ConflictException(
        'you can apply for only one professional role (lawyer or agent)',
      );
    }
    const open = await this.prisma.professionalRoleApplication.findFirst({
      where: {
        userId: user.id,
        role,
        status: {
          in: [
            ProfessionalRoleApplicationStatus.DRAFT,
            ProfessionalRoleApplicationStatus.SUBMITTED,
            ProfessionalRoleApplicationStatus.UNDER_REVIEW,
          ],
        },
      },
    });
    if (open) {
      throw new ConflictException('application already in progress for this role');
    }
    const approved = await this.prisma.professionalRoleApplication.findFirst({
      where: {
        userId: user.id,
        role,
        status: ProfessionalRoleApplicationStatus.APPROVED,
      },
    });
    if (approved) {
      throw new ConflictException('this professional role is already approved for your account');
    }
    const application = await this.prisma.professionalRoleApplication.create({
      data: {
        userId: user.id,
        role,
        status: ProfessionalRoleApplicationStatus.SUBMITTED,
        ...(dto.details && Object.keys(dto.details).length > 0
          ? { payload: dto.details as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.prisma.authAudit.create({
      data: {
        userId: user.id,
        event: 'professional_role_applied',
        detail: `role=${role}`,
      },
    });
    return {
      applicationId: application.id,
      role: application.role,
      status: application.status,
    };
  }
}
