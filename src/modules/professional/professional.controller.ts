import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ProfessionalApplyDto } from '../../dto/professional-apply.dto';
import { SessionService } from '../auth/session.service';
import { ProfessionalService } from './professional.service';

@Controller('users')
export class ProfessionalController {
  constructor(
    private readonly professional: ProfessionalService,
    private readonly session: SessionService,
  ) {}

  @Post('professional-roles/apply')
  async applyProfessionalRole(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-device-id') deviceId: string | undefined,
    @Body() dto: ProfessionalApplyDto,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(authorization, deviceId);
    return this.professional.applyProfessionalRole(session.user.id, dto);
  }
}
