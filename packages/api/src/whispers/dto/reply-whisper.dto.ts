import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ReplyWhisperDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  replyContent: string;
}
