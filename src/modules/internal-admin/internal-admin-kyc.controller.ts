import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalRejectProfessionalDto } from '../../dto/internal-reject-professional.dto';
import { InternalAdminKycReviewService } from './internal-admin-kyc-review.service';
import { InternalAdminSecretGuard } from './internal-admin-secret.guard';
import { CLIENT_RENEG_LIMIT } from 'node:tls';

@Controller('internal/admin/professional-kyc')
// @UseGuards(InternalAdminSecretGuard)
export class InternalAdminKycController {
  constructor(private readonly review: InternalAdminKycReviewService) {}

  @Get('applications')
  list() {
    console.log(CLIENT_RENEG_LIMIT);
    console.log({wors:"worksksks"});
    return this.review.listApplications();
  }

  @Get('applications/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.review.getApplicationDetail(id);
  }

  @Post('applications/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.review.approve(id);
  }

  @Post('applications/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalRejectProfessionalDto,
  ) {
    return this.review.reject(id, dto.reason);
  }
}
