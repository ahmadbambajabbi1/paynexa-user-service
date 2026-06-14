import { IsString, MaxLength, MinLength } from 'class-validator';

export class ProfileCompleteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;
}
