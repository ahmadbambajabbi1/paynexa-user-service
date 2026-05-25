import { ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UserSummariesBodyDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  userIds!: string[];
}
