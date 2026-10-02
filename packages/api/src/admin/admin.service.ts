import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private supabase: SupabaseService) {}

  async getPlatformAnalytics() {
    const [{ count: userCount }, { count: postCount }, { count: whisperCount }, { count: pendingReportCount }] =
      await Promise.all([
        this.supabase.admin.from('profiles').select('*', { count: 'exact', head: true }),
        this.supabase.admin.from('posts').select('*', { count: 'exact', head: true }),
        this.supabase.admin.from('whispers').select('*', { count: 'exact', head: true }),
        this.supabase.admin.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

    return {
      userCount: userCount ?? 0,
      postCount: postCount ?? 0,
      whisperCount: whisperCount ?? 0,
      pendingReportCount: pendingReportCount ?? 0,
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
}
