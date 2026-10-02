import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import type { User } from '@supabase/supabase-js';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/notifications
   * Get user's notifications feed
   */
  @Get()
  getMyNotifications(@CurrentUser() user: User) {
    return this.notificationsService.getMyNotifications(user);
  }

  /**
   * PATCH /api/notifications/read
   * Mark all or specific notification as read
   */
  @Patch('read')
  markAsRead(@CurrentUser() user: User, @Body('id') id?: string) {
    return this.notificationsService.markAsRead(user, id);
  }

  /**
   * POST /api/notifications/push-token
   * Register Expo push notification token
   */
  @Post('push-token')
  @HttpCode(HttpStatus.CREATED)
  registerPushToken(@CurrentUser() user: User, @Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.registerPushToken(user, dto);
  }
}
