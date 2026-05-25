import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ProfessionalApplyDto {
  @IsString()
  @IsIn(['LAWYER', 'AGENT'])
  role!: string;

  /** Role-specific fields (bar number, ID number, firm name, etc.). */
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
