import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KycSubmitDto } from '../../dto/kyc-submit.dto';
import { R2KycUploadService } from '../../infrastructure/r2/r2-kyc-upload.service';
import { SessionService } from '../auth/session.service';
import { KycService } from './kyc.service';

/** Memory-storage shape from `FileInterceptor` (avoids `Express.Multer` + @types/express@5 mismatch). */
type MemoryUploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@Controller('users')
export class KycController {
  constructor(
    private readonly kyc: KycService,
    private readonly session: SessionService,
    private readonly r2Kyc: R2KycUploadService,
  ) {}

  @Post('kyc/uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadKycFile(
    @UploadedFile() file: MemoryUploadedFile | undefined,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<{ key: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file');
    }
    const session = await this.session.resolveAuthenticatedSession(authorization, deviceId);
    return this.r2Kyc.uploadKycDocument({
      userId: session.user.id,
      buffer: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
      originalName: file.originalname,
    });
  }

  @Post('kyc')
  async submitKyc(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-device-id') deviceId: string | undefined,
    @Body() dto: KycSubmitDto,
  ): Promise<Record<string, unknown>> {
    const session = await this.session.resolveAuthenticatedSession(authorization, deviceId);
    return this.kyc.submitKyc(session.user.id, dto);
  }
}
