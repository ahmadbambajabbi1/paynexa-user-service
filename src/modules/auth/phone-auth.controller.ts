import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { PhoneAuthService } from './phone-auth.service';
import { PhonePinSessionDto } from './dto/phone-pin-session.dto';
import { PhoneSendCodeDto } from './dto/phone-send-code.dto';
import { PhoneVerifySmsDto } from './dto/phone-verify-sms.dto';

@Controller('users/auth/phone')
export class PhoneAuthController {
  constructor(private readonly phoneAuth: PhoneAuthService) {}

  @HttpCode(200)
  @Post('send-code')
  sendCode(@Body() dto: PhoneSendCodeDto): Promise<Record<string, unknown>> {
    return this.phoneAuth.sendCode(dto.phone, dto.countryCode);
  }

  @HttpCode(200)
  @Post('verify-sms')
  verifySms(
    @Body() dto: PhoneVerifySmsDto,
  ): Promise<Record<string, unknown>> {
    return this.phoneAuth.verifySmsAndIssuePreAuth(dto.phone, dto.code);
  }

  @HttpCode(200)
  @Post('set-pin')
  setPin(
    @Body() dto: PhonePinSessionDto,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ): Promise<Record<string, unknown>> {
    return this.phoneAuth.setPinAndCreateSession(
      dto.preAuthToken,
      dto.pin,
      dto.deviceId,
      dto.macAddress,
      dto.countryCode,
      req.ip ?? 'unknown',
      req.headers['user-agent'] ?? 'unknown',
    );
  }

  @HttpCode(200)
  @Post('verify-pin')
  verifyPin(
    @Body() dto: PhonePinSessionDto,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ): Promise<Record<string, unknown>> {
    return this.phoneAuth.verifyPinAndCreateSession(
      dto.preAuthToken,
      dto.pin,
      dto.deviceId,
      dto.macAddress,
      dto.countryCode,
      req.ip ?? 'unknown',
      req.headers['user-agent'] ?? 'unknown',
    );
  }
}
