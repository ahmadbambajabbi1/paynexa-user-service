import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class PhoneSendCodeDto {
  @IsString()
  @MinLength(8)
  phone!: string;

  /** ISO 3166-1 alpha-2 (e.g. GM) — stored on the user when the account is created or updated. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
}
