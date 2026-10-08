import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { User } from '@supabase/supabase-js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me
   * Returns the authenticated user's full profile + privacy settings.
   */
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  getMe(@CurrentUser() user: User) {
    return this.usersService.getMe(user);
  }

  /**
   * PATCH /api/users/me
   * Update authenticated user's profile (displayName, bio, isPrivate).
   */
  @Patch('me')
  @UseGuards(SupabaseAuthGuard)
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user, dto);
  }

  /**
   * GET /api/users/me/username-cooldown
   * Check 60-day username cooldown status and eligibility date.
   */
  @Get('me/username-cooldown')
  @UseGuards(SupabaseAuthGuard)
  getUsernameCooldown(@CurrentUser() user: User) {
    return this.usersService.getUsernameCooldown(user);
  }

  /**
   * POST /api/users/me/change-username
   * Atomically change username with 60-day cooldown enforcement.
   */
  @Post('me/change-username')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  changeUsername(
    @CurrentUser() user: User,
    @Body() body: { username: string },
  ) {
    return this.usersService.changeUsername(user, body.username);
  }

  /**
   * GET /api/users/:username
   * Fetch a public profile by username. No auth required.
   */
  @Get(':username')
  getProfile(@Param('username') username: string) {
    return this.usersService.getProfileByUsername(username);
  }

  /**
   * POST /api/users/:username/follow
   * Follow a user.
   */
  @Post(':username/follow')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  followUser(
    @CurrentUser() user: User,
    @Param('username') username: string,
  ) {
    return this.usersService.followUser(user, username);
  }

  /**
   * DELETE /api/users/:username/follow
   * Unfollow a user.
   */
  @Delete(':username/follow')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  unfollowUser(
    @CurrentUser() user: User,
    @Param('username') username: string,
  ) {
    return this.usersService.unfollowUser(user, username);
  }

  /**
   * GET /api/users/me/privacy
   * Get privacy settings for the authenticated user.
   */
  @Get('me/privacy')
  @UseGuards(SupabaseAuthGuard)
  getPrivacySettings(@CurrentUser() user: User) {
    return this.usersService.getPrivacySettings(user);
  }

  /**
   * PATCH /api/users/me/privacy
   * Update privacy settings.
   */
  @Patch('me/privacy')
  @UseGuards(SupabaseAuthGuard)
  updatePrivacySettings(
    @CurrentUser() user: User,
    @Body() settings: Record<string, unknown>,
  ) {
    return this.usersService.updatePrivacySettings(user, settings);
  }
}
