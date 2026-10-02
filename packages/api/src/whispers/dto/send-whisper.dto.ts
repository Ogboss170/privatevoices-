import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class SendWhisperDto {
  @IsString()
  @IsNotEmpty()
  recipientUsername: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;

  @IsOptional()
  @IsString()
  senderSessionHash?: string;
}
