import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';
export const RequireAdminPermission = (...permissions: string[]) =>
  SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);

export const SUPER_ADMIN_ONLY_KEY = 'super_admin_only';
export const RequireSuperAdmin = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);

@Injectable()
export class AdminRbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      ADMIN_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      SUPER_ADMIN_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no specific admin permission required, allow passing (base guard applies)
    if (!requiredPermissions?.length && !requiresSuperAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const userId = user.id;

    // Check if user has is_admin flag in profiles
    const { data: profile } = await this.supabase.admin
      .from('profiles')
      .select('id, is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (!profile || !profile.is_admin) {
      throw new ForbiddenException('Access denied: Staff administrator privileges required');
    }

    // Fetch user's assigned roles in admin_roles
    const { data: userRoles } = await this.supabase.admin
      .from('admin_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = (userRoles || []).map((r) => r.role);
    const isSuperAdmin = roles.includes('SUPER_ADMIN');

    // Attach role telemetry to request
    request.adminRoles = roles;
    request.isSuperAdmin = isSuperAdmin;

    // If super admin is required specifically
    if (requiresSuperAdmin && !isSuperAdmin) {
      // Allow fallback if no super admin has been seeded yet (bootstrap safety)
      const { count: superAdminCount } = await this.supabase.admin
        .from('admin_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'SUPER_ADMIN');

      if ((superAdminCount ?? 0) > 0) {
        throw new ForbiddenException('Access denied: SUPER_ADMIN role required');
      }
    }

    // Super Admin inherits all permissions automatically
    if (isSuperAdmin) {
      return true;
    }

    // Validate granular permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Query admin_role_permissions for the user's roles
      const { data: grantedPerms } = await this.supabase.admin
        .from('admin_role_permissions')
        .select('permission_id')
        .in('role', roles);

      const assignedPermSet = new Set((grantedPerms || []).map((p) => p.permission_id));
      const hasAllRequired = requiredPermissions.every((perm) => assignedPermSet.has(perm));

      if (!hasAllRequired) {
        throw new ForbiddenException(
          `Access denied: Missing required permission [${requiredPermissions.join(', ')}]`,
        );
      }
    }

    return true;
  }
}
