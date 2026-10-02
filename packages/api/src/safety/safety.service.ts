import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class SafetyService {
  constructor(private supabase: SupabaseService) {}

  async blockUser(user: User, targetUsername: string) {
    const { data: target } = await this.supabase.admin
      .from('profiles')
      .select('id, username')
      .ilike('username', targetUsername)
      .single();

    if (!target) throw new NotFoundException('User not found');
    if (target.id === user.id) throw new ForbiddenException('You cannot block yourself');

    const { error } = await this.supabase.admin.from('user_blocks').insert({
      blocker_id: user.id,
      blocked_id: target.id,
    });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException('Failed to block user');
    }

    // Record audit log
    await this.logAuditAction(user.id, 'block_user', 'profile', target.id);

    return { message: `User @${target.username} blocked successfully` };
  }

  async unblockUser(user: User, targetUsername: string) {
    const { data: target } = await this.supabase.admin
      .from('profiles')
      .select('id')
      .ilike('username', targetUsername)
      .single();

    if (!target) throw new NotFoundException('User not found');

    await this.supabase.admin
      .from('user_blocks')
      .delete()
      .match({ blocker_id: user.id, blocked_id: target.id });

    return { message: 'User unblocked successfully' };
  }

  async muteUser(user: User, targetUsername: string) {
    const { data: target } = await this.supabase.admin
      .from('profiles')
      .select('id, username')
      .ilike('username', targetUsername)
      .single();

    if (!target) throw new NotFoundException('User not found');

    await this.supabase.admin.from('user_mutes').insert({
      muter_id: user.id,
      muted_id: target.id,
    });

    return { message: `User @${target.username} muted` };
  }

  async unmuteUser(user: User, targetUsername: string) {
    const { data: target } = await this.supabase.admin
      .from('profiles')
      .select('id')
      .ilike('username', targetUsername)
      .single();

    if (!target) throw new NotFoundException('User not found');

    await this.supabase.admin
      .from('user_mutes')
      .delete()
      .match({ muter_id: user.id, muted_id: target.id });

    return { message: 'User unmuted' };
  }

  async suspendUser(adminUser: User, targetUserId: string, reason: string) {
    const { error } = await this.supabase.admin
      .from('user_suspensions')
      .insert({
        user_id: targetUserId,
        reason,
        suspended_by: adminUser.id,
      });

    if (error) throw new InternalServerErrorException('Failed to suspend user');

    await this.logAuditAction(adminUser.id, 'suspend_user', 'profile', targetUserId, { reason });

    return { message: 'User suspended successfully' };
  }

  async getAuditLogs() {
    const { data: logs, error } = await this.supabase.admin
      .from('audit_logs')
      .select('*, actor:profiles!audit_logs_actor_id_fkey(id, username, display_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new InternalServerErrorException('Failed to fetch audit logs');
    return logs ?? [];
  }

  private async logAuditAction(
    actorId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    details?: any,
  ) {
    await this.supabase.admin.from('audit_logs').insert({
      actor_id: actorId,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? null,
    });
  }
}
