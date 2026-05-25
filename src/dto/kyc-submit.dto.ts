import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class KycSubmitDto {
  @IsOptional()
  @IsString()
  @IsIn(['PERSONAL', 'LAWYER', 'AGENT', 'VERIFIER'])
  kind?: string;

  @IsOptional()
  @IsUUID()
  professionalApplicationId?: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsString()
  @MinLength(1)
  fileKey!: string;

  @IsString()
  @MinLength(1)
  uploader!: string;
}
