import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('admin')
@UseGuards(SupabaseAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /api/admin/analytics
   * Get platform metrics (users, posts, whispers, reports)
   */
  @Get('analytics')
  getAnalytics() {
    return this.adminService.getPlatformAnalytics();
  }

  /**
   * GET /api/admin/reports?status=pending|actioned|dismissed
   * Get moderation report queue
   */
  @Get('reports')
  getReports(@Query('status') status = 'pending') {
    return this.adminService.getReports(status);
  }

  /**
   * PATCH /api/admin/reports/:id
   * Take moderation action on a report (dismiss or delete content)
   */
  @Patch('reports/:id')
  actionReport(
    @Param('id') id: string,
    @Body('action') action: 'dismiss' | 'delete_content' | 'actioned',
  ) {
    return this.adminService.actionReport(id, action);
  }
}
