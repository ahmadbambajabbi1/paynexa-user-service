import { IsString, Length, MinLength } from 'class-validator';

export class PhoneVerifySmsDto {
  @IsString()
  @MinLength(8)
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
