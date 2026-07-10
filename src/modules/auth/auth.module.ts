import { Module } from '@nestjs/common';
import { PhoneAuthController } from './phone-auth.controller';
import { PhoneAuthService } from './phone-auth.service';
import { OtpService } from './otp.service';
import { PreAuthTokenService } from './preauth-token.service';
import { SessionService } from './session.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RabbitmqModule } from '../../infrastructure/rabbitmq/rabbitmq.module';
import { SessionCacheModule } from '../../infrastructure/session-cache/session-cache.module';

@Module({
  imports: [PrismaModule, RabbitmqModule, SessionCacheModule],
  controllers: [PhoneAuthController],
  providers: [
    OtpService,
    PreAuthTokenService,
    SessionService,
    PhoneAuthService,
  ],
  exports: [SessionService, OtpService],
})
export class AuthModule {}
