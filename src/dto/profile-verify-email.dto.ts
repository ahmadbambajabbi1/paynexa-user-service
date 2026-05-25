import { IsString, Matches } from 'class-validator';

export class ProfileVerifyEmailDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
