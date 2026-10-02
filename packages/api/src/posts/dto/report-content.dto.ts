import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class ReportContentDto {
  @IsIn(['post', 'comment', 'profile'])
  targetType: 'post' | 'comment' | 'profile';

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}
