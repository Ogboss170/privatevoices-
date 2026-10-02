import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;
}
