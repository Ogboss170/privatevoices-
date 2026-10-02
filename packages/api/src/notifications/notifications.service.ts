import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import type { User } from '@supabase/supabase-js';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'message'
  | 'whisper'
  | 'community_activity'
  | 'system';

interface SendNotificationOptions {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body: string;
  targetUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private supabase: SupabaseService) {}

  async createNotification(opts: SendNotificationOptions) {
    const { data: notification, error } = await this.supabase.admin
      .from('notifications')
      .insert({
        user_id: opts.userId,
        actor_id: opts.actorId ?? null,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        target_url: opts.targetUrl ?? null,
      })
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .single();

    if (error) throw new InternalServerErrorException('Failed to create notification');

    // Trigger Expo Push Notification if user registered a mobile push token
    this.sendExpoPushNotification(opts.userId, opts.title, opts.body).catch(() => {});

    return notification;
  }

  async getMyNotifications(user: User) {
    const { data: notifications, error } = await this.supabase.admin
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch notifications');
    return notifications ?? [];
  }

  async markAsRead(user: User, notificationId?: string) {
    let query = this.supabase.admin.from('notifications').update({ is_read: true }).eq('user_id', user.id);

    if (notificationId) {
      query = query.eq('id', notificationId);
    }

    const { error } = await query;
    if (error) throw new InternalServerErrorException('Failed to mark notification as read');
    return { message: 'Notifications marked as read' };
  }

  async registerPushToken(user: User, dto: RegisterPushTokenDto) {
    const { error } = await this.supabase.admin
      .from('user_push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_push_token: dto.expoPushToken,
          device_type: dto.deviceType ?? 'mobile',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, expo_push_token' }
      );

    if (error) throw new InternalServerErrorException('Failed to register push token');
    return { message: 'Push token registered successfully' };
  }

  private async sendExpoPushNotification(userId: string, title: string, body: string) {
    const { data: tokens } = await this.supabase.admin
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title,
      body,
    }));

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch {
      // Safe fallback
    }
  }
}
