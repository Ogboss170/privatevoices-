import { Controller, Post, Delete, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@supabase/supabase-js';

@Controller('safety')
@UseGuards(SupabaseAuthGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  /**
   * POST /api/safety/block/:username
   * Block a user
   */
  @Post('block/:username')
  blockUser(@CurrentUser() user: User, @Param('username') username: string) {
    return this.safetyService.blockUser(user, username);
  }

  /**
   * DELETE /api/safety/block/:username
   * Unblock a user
   */
  @Delete('block/:username')
  unblockUser(@CurrentUser() user: User, @Param('username') username: string) {
    return this.safetyService.unblockUser(user, username);
  }

  /**
   * POST /api/safety/mute/:username
   * Mute a user
   */
  @Post('mute/:username')
  muteUser(@CurrentUser() user: User, @Param('username') username: string) {
    return this.safetyService.muteUser(user, username);
  }

  /**
   * DELETE /api/safety/mute/:username
   * Unmute a user
   */
  @Delete('mute/:username')
  unmuteUser(@CurrentUser() user: User, @Param('username') username: string) {
    return this.safetyService.unmuteUser(user, username);
  }

  /**
   * POST /api/safety/suspend
   * Admin suspend a user
   */
  @Post('suspend')
  suspendUser(
    @CurrentUser() adminUser: User,
    @Body('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.safetyService.suspendUser(adminUser, userId, reason);
  }

  /**
   * GET /api/safety/audit-logs
   * Admin fetch system audit logs
   */
  @Get('audit-logs')
  getAuditLogs() {
    return this.safetyService.getAuditLogs();
  }
}
