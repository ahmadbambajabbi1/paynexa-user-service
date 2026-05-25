import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RabbitmqModule } from '../../infrastructure/rabbitmq/rabbitmq.module';
import { R2KycUploadService } from '../../infrastructure/r2/r2-kyc-upload.service';
import { AuthModule } from '../auth/auth.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [PrismaModule, RabbitmqModule, AuthModule],
  controllers: [KycController],
  providers: [KycService, R2KycUploadService],
})
export class KycModule {}
