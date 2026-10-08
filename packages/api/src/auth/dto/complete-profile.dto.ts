import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  userId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may only contain letters, numbers and underscores',
  })
  username: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName: string;

  @IsString()
  email?: string;

  acceptedTerms?: boolean;
  acceptedTermsAt?: string;
}
