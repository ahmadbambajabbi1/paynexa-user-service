import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InternalRejectProfessionalDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
