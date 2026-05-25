import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { InternalServiceMarketplaceUsersController } from './internal-service-marketplace-users.controller';
import { InternalServiceMarketplaceUsersService } from './internal-service-marketplace-users.service';
import { ServiceMarketplaceInternalGuard } from './service-marketplace-internal.guard';

@Module({
  imports: [PrismaModule],
  controllers: [InternalServiceMarketplaceUsersController],
  providers: [InternalServiceMarketplaceUsersService, ServiceMarketplaceInternalGuard],
})
export class InternalServiceMarketplaceUsersModule {}
