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
import { InternalAdminPersonalKycService } from './internal-admin-personal-kyc.service';
import { InternalAdminSecretGuard } from './internal-admin-secret.guard';

@Controller('internal/admin/personal-kyc')
// @UseGuards(InternalAdminSecretGuard)
export class InternalAdminPersonalKycController {
  constructor(private readonly personal: InternalAdminPersonalKycService) {}

  @Get('pending')
  listPending() {
    console.log({wors:"worksksks"});
    // console.log(CLIENT_RENEG_LIMIT);
    return this.personal.listPending();
  }

  @Get('users/:userId')
  detail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.personal.getUserDetail(userId);
  }

  @Post('users/:userId/approve')
  approve(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.personal.approve(userId);
  }

  @Post('users/:userId/reject')
  reject(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: InternalRejectProfessionalDto,
  ) {
    return this.personal.reject(userId, dto.reason);
  }
}
