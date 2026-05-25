import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ServiceMarketplaceInternalGuard } from './service-marketplace-internal.guard';
import { UserSummariesBodyDto } from './dto/user-summaries-body.dto';
import { InternalServiceMarketplaceUsersService } from './internal-service-marketplace-users.service';

@Controller('internal/service-marketplace-users')
@UseGuards(ServiceMarketplaceInternalGuard)
export class InternalServiceMarketplaceUsersController {
  constructor(private readonly svc: InternalServiceMarketplaceUsersService) {}

  @Post('summaries')
  async summaries(@Body() dto: UserSummariesBodyDto) {
    const unique = Array.from(new Set(dto.userIds.map((x) => x.trim()))).slice(0, 48);
    return this.svc.summaries(unique);
  }
}
