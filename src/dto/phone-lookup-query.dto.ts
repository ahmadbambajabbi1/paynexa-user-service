import { IsString, MinLength } from 'class-validator';

export class PhoneLookupQueryDto {
  @IsString()
  @MinLength(8)
  phone!: string;
}
