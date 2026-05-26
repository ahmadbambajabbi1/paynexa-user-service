import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { R2KycUploadService } from '../../infrastructure/r2/r2-kyc-upload.service';
import { InternalAdminKycController } from './internal-admin-kyc.controller';
import { InternalAdminKycReviewService } from './internal-admin-kyc-review.service';
import { InternalAdminPersonalKycController } from './internal-admin-personal-kyc.controller';
import { InternalAdminPersonalKycService } from './internal-admin-personal-kyc.service';
import { InternalAdminSecretGuard } from './internal-admin-secret.guard';

@Module({
  imports: [PrismaModule],
  controllers: [InternalAdminKycController, InternalAdminPersonalKycController],
  providers: [
    InternalAdminKycReviewService,
    InternalAdminPersonalKycService,
    R2KycUploadService,
    InternalAdminSecretGuard,
  ],
  exports: [InternalAdminKycReviewService, InternalAdminPersonalKycService],
})
export class InternalAdminModule {}
