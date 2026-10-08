import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  AdminRbacGuard,
  RequireAdminPermission,
  RequireSuperAdmin,
} from './admin-rbac.guard';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, AdminRbacGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /api/admin/analytics
   */
  @Get('analytics')
  @RequireAdminPermission('users.read')
  getAnalytics() {
    return this.adminService.getPlatformAnalytics();
  }

  /**
   * GET /api/admin/reports
   */
  @Get('reports')
  @RequireAdminPermission('reports.review')
  getReports(@Query('status') status = 'pending') {
    return this.adminService.getReports(status);
  }

  /**
   * PATCH /api/admin/reports/:id
   */
  @Patch('reports/:id')
  @RequireAdminPermission('moderation.manage')
  actionReport(
    @Param('id') id: string,
    @Body('action') action: 'dismiss' | 'delete_content' | 'actioned',
  ) {
    return this.adminService.actionReport(id, action);
  }

  /**
   * GET /api/admin/staff
   * List all staff administrators and roles
   */
  @Get('staff')
  @RequireAdminPermission('admin.roles.manage')
  getStaffDirectory() {
    return this.adminService.getStaffDirectory();
  }

  /**
   * POST /api/admin/staff/roles
   * Assign administrative role (Requires admin.roles.manage; SUPER_ADMIN assignment requires SUPER_ADMIN caller)
   */
  @Post('staff/roles')
  @RequireAdminPermission('admin.roles.manage')
  assignRole(
    @Req() req: any,
    @Body() body: { targetUserId: string; role: string; reason: string },
  ) {
    return this.adminService.assignRole(
      req.user.id,
      body.targetUserId,
      body.role,
      body.reason,
    );
  }

  /**
   * DELETE /api/admin/staff/roles
   * Revoke administrative role (Protected against revoking last SUPER_ADMIN)
   */
  @Delete('staff/roles')
  @RequireAdminPermission('admin.roles.manage')
  revokeRole(
    @Req() req: any,
    @Body() body: { targetUserId: string; role: string; reason: string },
  ) {
    return this.adminService.revokeRole(
      req.user.id,
      body.targetUserId,
      body.role,
      body.reason,
    );
  }

  /**
   * POST /api/admin/staff/disable
   * Disable administrator access entirely
   */
  @Post('staff/disable')
  @RequireSuperAdmin()
  disableStaff(
    @Req() req: any,
    @Body() body: { targetUserId: string; reason: string },
  ) {
    return this.adminService.disableStaffAccount(
      req.user.id,
      body.targetUserId,
      body.reason,
    );
  }

  /**
   * GET /api/admin/audit-logs
   */
  @Get('audit-logs')
  @RequireAdminPermission('audit.read')
  getAuditLogs(@Query('limit') limit = 100) {
    return this.adminService.getAuditLogs(Number(limit) || 100);
  }

  /**
   * POST /api/admin/bug-reports
   */
  @Post('bug-reports')
  @RequireAdminPermission('bug_reports.create')
  createBugReport(@Req() req: any, @Body() body: any) {
    return this.adminService.createBugReport(req.user.id, body);
  }

  /**
   * GET /api/admin/bug-reports
   */
  @Get('bug-reports')
  @RequireAdminPermission('bug_reports.read')
  getBugReports(@Req() req: any, @Query('status') status?: string) {
    const isSecurityAuthorized =
      req.isSuperAdmin ||
      (req.adminRoles && req.adminRoles.includes('ADMIN'));
    return this.adminService.getBugReports(isSecurityAuthorized, status);
  }

  /**
   * GET /api/admin/bug-reports/:id
   */
  @Get('bug-reports/:id')
  @RequireAdminPermission('bug_reports.read')
  getBugReportById(@Req() req: any, @Param('id') id: string) {
    const isSecurityAuthorized =
      req.isSuperAdmin ||
      (req.adminRoles && req.adminRoles.includes('ADMIN'));
    return this.adminService.getBugReportById(id, isSecurityAuthorized);
  }

  /**
   * PATCH /api/admin/bug-reports/:id
   */
  @Patch('bug-reports/:id')
  @RequireAdminPermission('bug_reports.update')
  updateBugReport(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateBugReport(req.user.id, id, body);
  }

  /**
   * POST /api/admin/bug-reports/:id/comments
   */
  @Post('bug-reports/:id/comments')
  @RequireAdminPermission('bug_reports.update')
  addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body('body') body: string,
  ) {
    return this.adminService.addBugReportComment(req.user.id, id, body);
  }
}
