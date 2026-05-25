import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class PhonePinSessionDto {
  @IsString()
  @MinLength(20)
  preAuthToken!: string;

  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;

  @IsString()
  @MinLength(4)
  deviceId!: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
}
