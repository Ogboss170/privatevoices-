import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;

  @IsOptional()
  @IsString()
  deviceType?: 'ios' | 'android' | 'web';
}
