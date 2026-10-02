import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class CreateStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(['text', 'image'])
  mediaType?: 'text' | 'image';

  @IsOptional()
  @IsIn(['everyone', 'followers', 'close_friends', 'custom'])
  visibility?: 'everyone' | 'followers' | 'close_friends' | 'custom';
}
