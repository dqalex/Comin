/**
 * API Route 认证包装器
 * 
 * v3.0: 为 Route Handler 提供声明式的认证保护
 * 
 * 用法：
 * ```ts
 * // 需要登录
 * export const GET = withAuth(async (request, auth) => {
 *   console.log(auth.userId);
 *   return NextResponse.json({ data: 'ok' });
 * });
 * 
 * // 需要管理员权限
 * export const DELETE = withAuth(async (request, auth) => {
 *   // ...
 * }, { requireAdmin: true });
 * 
 * // 可选认证（未登录也能访问，但登录后有更多功能）
 * export const GET = withAuth(async (request, auth) => {
 *   if (auth) {
 *     // 已登录用户
 *   }
 * }, { optional: true });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  createUnauthorizedResponse,
  createForbiddenResponse,
  type AuthResult,
} from './api-auth';

// 重新导出 AuthResult 类型，方便其他模块使用
export type { AuthResult };

// ============================================================
// 类型定义
// ============================================================

export interface WithAuthOptions {
  /** 可选认证：未登录也能访问 */
  optional?: boolean;
  /** 要求管理员权限 */
  requireAdmin?: boolean;
  /** 允许的角色列表（不设置则所有角色均可） */
  allowedRoles?: ('admin' | 'member' | 'viewer')[];
}

// 基础 Route Context 类型
export interface RouteContext<T extends Record<string, string> = Record<string, string>> {
  params: Promise<T>;
}

type AuthenticatedHandler<T extends Record<string, string> = Record<string, string>> = (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<T>
) => Promise<NextResponse>;

type OptionalAuthHandler<T extends Record<string, string> = Record<string, string>> = (
  request: NextRequest,
  auth: AuthResult | null,
  context?: RouteContext<T>
) => Promise<NextResponse>;

// ============================================================
// 认证包装器
// ============================================================

/**
 * 带认证的 Route Handler 包装器
 */
export function withAuth<T extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandler<T>,
  options?: WithAuthOptions & { optional?: false }
): (request: NextRequest, context?: RouteContext<T>) => Promise<NextResponse>;

export function withAuth<T extends Record<string, string> = Record<string, string>>(
  handler: OptionalAuthHandler<T>,
  options: WithAuthOptions & { optional: true }
): (request: NextRequest, context?: RouteContext<T>) => Promise<NextResponse>;

export function withAuth<T extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandler<T> | OptionalAuthHandler<T>,
  options: WithAuthOptions = {}
): (request: NextRequest, context?: RouteContext<T>) => Promise<NextResponse> {
  return async (request: NextRequest, context?: RouteContext<T>) => {
    try {
      // 执行认证
      const auth = await authenticateRequest(request);

      // 可选认证模式
      if (options.optional) {
        const optionalHandler = handler as OptionalAuthHandler<T>;
        return optionalHandler(request, auth.authenticated ? auth : null, context);
      }

      // 强制认证模式
      if (!auth.authenticated) {
        return createUnauthorizedResponse(auth.error);
      }

      // 管理员权限检查
      if (options.requireAdmin && auth.userRole !== 'admin') {
        return createForbiddenResponse('需要管理员权限');
      }

      // 角色检查
      if (options.allowedRoles && auth.userRole && !options.allowedRoles.includes(auth.userRole)) {
        return createForbiddenResponse(`需要 ${options.allowedRoles.join(' 或 ')} 权限`);
      }

      // 调用实际 handler
      const authenticatedHandler = handler as AuthenticatedHandler<T>;
      return authenticatedHandler(request, auth, context);
    } catch (error) {
      console.error('[WITH-AUTH] Unexpected error:', error);
      return NextResponse.json(
        { error: '服务器内部错误' },
        { status: 500 }
      );
    }
  };
}

// ============================================================
// 快捷方式
// ============================================================

/**
 * 需要管理员权限的 Route Handler
 */
export function withAdminAuth<T extends Record<string, string> = Record<string, string>>(handler: AuthenticatedHandler<T>) {
  return withAuth(handler, { requireAdmin: true });
}

/**
 * 可选认证的 Route Handler
 */
export function withOptionalAuth<T extends Record<string, string> = Record<string, string>>(handler: OptionalAuthHandler<T>) {
  return withAuth(handler, { optional: true });
}

/**
 * 只允许 admin 和 member 角色
 */
export function withMemberAuth<T extends Record<string, string> = Record<string, string>>(handler: AuthenticatedHandler<T>) {
  return withAuth(handler, { allowedRoles: ['admin', 'member'] });
}
