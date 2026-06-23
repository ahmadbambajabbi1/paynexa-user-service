import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { PhoneLookupQueryDto } from '../../dto/phone-lookup-query.dto';
import { ProfileCompleteDto } from '../../dto/profile-complete.dto';
import { ProfileVerifyEmailDto } from '../../dto/profile-verify-email.dto';
import { RegisterFcmTokenDto } from '../../dto/register-fcm-token.dto';
import { CreateDeliveryAddressDto } from '../../dto/create-delivery-address.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  health(): { service: string; status: string } {
    return { service: 'user-service', status: 'ok' };
  }

  @Get('countries/operating')
  operatingCountries(): Promise<Record<string, unknown>> {
    return this.users.listOperatingCountries();
  }

  @Get('me')
  me(
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.getMe(authorization, deviceId);
  }

  @Get('lookup')
  lookupUserByPhone(
    @Query() query: PhoneLookupQueryDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.lookupUserByPhone(authorization, deviceId, query.phone);
  }

  @Get('search')
  searchByEmailOrPhone(@Query('query') query?: string): Promise<Record<string, unknown>> {
    return this.users.searchByEmailOrPhone(query);
  }

  @Get('professionals/search')
  searchProfessionals(
    @Query('role') role?: string,
    @Query('query') query?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.searchApprovedProfessionals(role, query);
  }

  @Get('kyc/personal-status')
  personalKycStatus(@Query('userId') userId?: string): Promise<Record<string, unknown>> {
    return this.users.personalKycStatus(userId);
  }

  @HttpCode(200)
  @Post('profile/complete')
  completeProfile(
    @Body() dto: ProfileCompleteDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.completeProfile(authorization, deviceId, dto);
  }

  @HttpCode(200)
  @Post('profile/verify-email')
  verifyProfileEmail(
    @Body() dto: ProfileVerifyEmailDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.verifyProfileEmail(authorization, deviceId, dto);
  }

  @HttpCode(200)
  @Post('profile/resend-email-verification')
  resendProfileEmailVerification(
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.resendProfileEmailVerification(authorization, deviceId);
  }

  @HttpCode(200)
  @Post('devices/fcm-token')
  registerFcmToken(
    @Body() dto: RegisterFcmTokenDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.registerFcmToken(
      authorization,
      deviceId,
      dto.fcmToken,
      dto.platform,
    );
  }

  @Get('me/delivery-addresses')
  listDeliveryAddresses(
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.listDeliveryAddresses(authorization, deviceId);
  }

  @HttpCode(201)
  @Post('me/delivery-addresses')
  createDeliveryAddress(
    @Body() dto: CreateDeliveryAddressDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.users.createDeliveryAddress(authorization, deviceId, dto);
  }
}
