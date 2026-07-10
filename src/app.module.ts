import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RabbitmqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { SessionCacheModule } from './infrastructure/session-cache/session-cache.module';
import { SessionCacheListener } from './infrastructure/session-cache/session-cache.listener';
import { EmailModule } from './infrastructure/email/email.module';
import { SmsModule } from './infrastructure/sms/sms.module';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { InternalAdminModule } from './modules/internal-admin/internal-admin.module';
import { InternalServiceMarketplaceUsersModule } from './modules/internal-service-marketplace/internal-service-marketplace-users.module';
import { ProfessionalModule } from './modules/professional/professional.module';
import { UsersModule } from './modules/users/users.module';

import { RabbitmqRpcConsumer } from './infrastructure/rabbitmq/rabbitmq-rpc.consumer';
import { R2KycUploadService } from './infrastructure/r2/r2-kyc-upload.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RabbitmqModule,
    SessionCacheModule,
    SmsModule,
    EmailModule,
    AuthModule,
    UsersModule,
    KycModule,
    ProfessionalModule,
    InternalAdminModule,
    InternalServiceMarketplaceUsersModule,
  ],
  providers: [RabbitmqRpcConsumer, R2KycUploadService, SessionCacheListener],
})
export class AppModule {}
