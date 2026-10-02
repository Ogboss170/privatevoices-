import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/complete-profile
   *
   * Called by the web/mobile client immediately after Supabase Auth sign-up
   * to create the user's profile row and default privacy settings.
   */
  @Post('complete-profile')
  @HttpCode(HttpStatus.CREATED)
  completeProfile(@Body() dto: CompleteProfileDto) {
    return this.authService.completeProfile(dto);
  }
}
