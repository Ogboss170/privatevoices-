import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private supabase: SupabaseService) {}

  async getPlatformAnalytics() {
    const [
      { count: userCount },
      { count: postCount },
      { count: whisperCount },
      { count: pendingReportCount },
      { count: suspendedCount },
      { count: superAdminCount },
    ] = await Promise.all([
      this.supabase.admin.from('profiles').select('*', { count: 'exact', head: true }),
      this.supabase.admin.from('posts').select('*', { count: 'exact', head: true }),
      this.supabase.admin.from('whispers').select('*', { count: 'exact', head: true }),
      this.supabase.admin.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      this.supabase.admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      this.supabase.admin.from('admin_roles').select('*', { count: 'exact', head: true }).eq('role', 'SUPER_ADMIN'),
    ]);

    return {
      userCount: userCount ?? 0,
      postCount: postCount ?? 0,
      whisperCount: whisperCount ?? 0,
      pendingReportCount: pendingReportCount ?? 0,
      suspendedCount: suspendedCount ?? 0,
      superAdminCount: superAdminCount ?? 0,
    };
  }

  async getReports(status = 'pending') {
    const { data: reports, error } = await this.supabase.admin
      .from('content_reports')
      .select('*, reporter:profiles!content_reports_reporter_id_fkey(id, username, display_name)')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch reports');
    return reports ?? [];
  }

  async actionReport(reportId: string, action: 'dismiss' | 'delete_content' | 'actioned') {
    const { data: report } = await this.supabase.admin
      .from('content_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (!report) throw new NotFoundException('Report not found');

    if (action === 'delete_content') {
      if (report.target_type === 'post') {
        await this.supabase.admin.from('posts').delete().eq('id', report.target_id);
      } else if (report.target_type === 'comment') {
        await this.supabase.admin.from('comments').delete().eq('id', report.target_id);
      } else if (report.target_type === 'whisper') {
        await this.supabase.admin.from('whispers').delete().eq('id', report.target_id);
      }
    }

    const { data: updated, error } = await this.supabase.admin
      .from('content_reports')
      .update({ status: action === 'dismiss' ? 'dismissed' : 'actioned' })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException('Failed to update report status');
    return updated;
  }

  // ─── Super Admin Staff & Role Management Methods ───────────────────────────

  async getStaffDirectory() {
    const { data, error } = await this.supabase.admin.rpc('admin_get_staff_directory');
    if (error) {
      // Fallback query
      const { data: profiles, error: pErr } = await this.supabase.admin
        .from('profiles')
        .select('id, username, display_name, is_admin, is_banned')
        .eq('is_admin', true);

      if (pErr) throw new InternalServerErrorException(pErr.message);

      const { data: roles } = await this.supabase.admin.from('admin_roles').select('*');

      return (profiles || []).map((p) => ({
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        is_admin: p.is_admin,
        is_banned: p.is_banned,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        assigned_at: (roles || []).find((r) => r.user_id === p.id)?.assigned_at,
        notes: (roles || []).find((r) => r.user_id === p.id)?.notes,
      }));
    }
    return data ?? [];
  }

  async assignRole(actorId: string, targetUserId: string, role: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Mandatory reason required for administrative role assignment');
    }

    // Call stored procedure
    const { data, error } = await this.supabase.admin.rpc('admin_assign_role', {
      p_target_user_id: targetUserId,
      p_role: role,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data?.success) {
      throw new ForbiddenException(data?.error || 'Role assignment failed');
    }

    return { success: true, targetUserId, role };
  }

  async revokeRole(actorId: string, targetUserId: string, role: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Mandatory reason required for administrative role revocation');
    }

    const { data, error } = await this.supabase.admin.rpc('admin_revoke_role', {
      p_target_user_id: targetUserId,
      p_role: role,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data?.success) {
      throw new ForbiddenException(data?.error || 'Role revocation failed');
    }

    return { success: true, targetUserId, role };
  }

  async disableStaffAccount(actorId: string, targetUserId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Mandatory reason required for disabling staff account');
    }

    const { data, error } = await this.supabase.admin.rpc('admin_disable_staff', {
      p_target_user_id: targetUserId,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data?.success) {
      throw new ForbiddenException(data?.error || 'Failed to disable staff account');
    }

    return { success: true, targetUserId };
  }

  async getAuditLogs(limit = 100) {
    const { data, error } = await this.supabase.admin
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new InternalServerErrorException('Failed to fetch audit ledger');
    return data ?? [];
  }
}
