import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRbacGuard, ADMIN_PERMISSIONS_KEY, SUPER_ADMIN_ONLY_KEY } from './admin-rbac.guard';

describe('AdminRbacGuard', () => {
  let guard: AdminRbacGuard;
  let reflector: Reflector;
  let mockSupabase: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockSupabase = {
      admin: {
        from: vi.fn(),
      },
    };
    guard = new AdminRbacGuard(reflector, mockSupabase);
  });

  function createMockContext(user: any) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access if no admin permissions or super admin requirement are set', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ id: 'user-123' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws UnauthorizedException if user is missing', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_PERMISSIONS_KEY) return ['users.read'];
      return undefined;
    });
    const context = createMockContext(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException if user is not an admin in profiles', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_PERMISSIONS_KEY) return ['users.read'];
      return undefined;
    });
    const context = createMockContext({ id: 'user-non-admin' });

    mockSupabase.admin.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'user-non-admin', is_admin: false } }),
            }),
          }),
        };
      }
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows SUPER_ADMIN to pass any granular permission check', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_PERMISSIONS_KEY) return ['admin.roles.manage', 'security.manage'];
      return undefined;
    });
    const context = createMockContext({ id: 'super-admin-user' });

    mockSupabase.admin.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'super-admin-user', is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'admin_roles') {
        return {
          select: () => ({
            eq: async () => ({ data: [{ role: 'SUPER_ADMIN' }] }),
          }),
        };
      }
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('denies user when specific SUPER_ADMIN check is required and user only has MODERATOR role', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === SUPER_ADMIN_ONLY_KEY) return true;
      return undefined;
    });
    const context = createMockContext({ id: 'mod-user' });

    mockSupabase.admin.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'mod-user', is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'admin_roles') {
        return {
          select: (_query: string, options?: any) => {
            if (options?.head) {
              return {
                eq: async () => ({ count: 1 }), // Active super admins exist
              };
            }
            return {
              eq: async () => ({ data: [{ role: 'MODERATOR' }] }),
            };
          },
        };
      }
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('enforces granular role permission mapping correctly', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_PERMISSIONS_KEY) return ['reports.review'];
      return undefined;
    });
    const context = createMockContext({ id: 'mod-user' });

    mockSupabase.admin.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'mod-user', is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'admin_roles') {
        return {
          select: () => ({
            eq: async () => ({ data: [{ role: 'MODERATOR' }] }),
          }),
        };
      }
      if (table === 'admin_role_permissions') {
        return {
          select: () => ({
            in: async () => ({ data: [{ permission_id: 'reports.review' }] }),
          }),
        };
      }
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
