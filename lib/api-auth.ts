/**
 * API 统一认证模块
 * 
 * v3.0: 为所有业务 API 提供统一的认证检查
 * 
 * 认证方式：
 * 1. Session Cookie（用户登录后）
 * 2. Bearer Token（MCP 外部调用 / User MCP Token）
 * 
 * 白名单 API（无需认证）：
 * - 认证相关：/api/auth/*
 * - 健康检查：/api/diag/*, /api/heartbeat/*
 * - SSE 流：/api/sse（会在 handler 内部验证）
 * - MCP 外部：/api/mcp/external（有独立的 token 验证）
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, getUserById } from '@/lib/auth';
import { db, users, userMcpTokens } from '@/db';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Session cookie 名称（与 login API 保持一致）
const SESSION_COOKIE_NAME = 'cms_session';

// ============================================================
// 白名单配置
// ============================================================

// 完全公开的 API 路径前缀（无需任何认证）
const PUBLIC_API_PREFIXES = [
  '/api/auth/',        // 认证相关（登录、注册、重置密码等）
  '/api/diag/',        // 诊断接口
  '/api/heartbeat/',   // 心跳检测
];

// 需要特殊处理的 API（有独立认证机制）
const SPECIAL_AUTH_APIS = [
  '/api/mcp/external', // 使用 AI Member Token 认证
  '/api/sse',          // SSE 流，使用 query token
];

// 只读 API（GET 请求可选认证，写操作必须认证）
// 用于支持公开浏览但限制修改
const READ_OPTIONAL_AUTH_PREFIXES: string[] = [
  // 目前所有 API 都要求认证，如需公开浏览可在此添加
];

// ============================================================
// 认证结果类型
// ============================================================

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  userRole?: 'admin' | 'member' | 'viewer';
  userName?: string;
  userEmail?: string;
  authMethod?: 'session' | 'bearer' | 'user-mcp-token';
  error?: string;
}

// ============================================================
// 路径检查函数
// ============================================================

/**
 * 检查路径是否匹配前缀列表
 */
function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => pathname.startsWith(prefix));
}

/**
 * 检查是否是公开 API
 */
export function isPublicApi(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_API_PREFIXES);
}

/**
 * 检查是否是特殊认证 API
 */
export function isSpecialAuthApi(pathname: string): boolean {
  return SPECIAL_AUTH_APIS.some(api => pathname.startsWith(api));
}

/**
 * 检查是否是只读可选认证 API
 */
export function isReadOptionalApi(pathname: string): boolean {
  return matchesPrefix(pathname, READ_OPTIONAL_AUTH_PREFIXES);
}

// ============================================================
// Session Cookie 认证
// ============================================================

/**
 * 从 cookie 获取当前用户信息
 */
export async function getSessionUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return { authenticated: false, error: '未登录' };
    }

    const { valid, userId, expired } = verifySessionToken(sessionToken);

    if (!valid) {
      return { 
        authenticated: false, 
        error: expired ? '登录已过期，请重新登录' : '无效的会话' 
      };
    }

    if (!userId) {
      return { authenticated: false, error: '会话数据异常' };
    }

    // 查询用户信息
    const user = await getUserById(userId);
    if (!user) {
      return { authenticated: false, error: '用户不存在' };
    }

    return {
      authenticated: true,
      userId: user.id,
      userRole: user.role as 'admin' | 'member' | 'viewer',
      userName: user.name,
      userEmail: user.email,
      authMethod: 'session',
    };
  } catch (error) {
    console.error('[API-AUTH] Session check failed:', error);
    return { authenticated: false, error: '认证服务异常' };
  }
}

// ============================================================
// User MCP Token 认证
// ============================================================

/**
 * 验证 User MCP Token（Bearer Token）
 * 与 AI Member Token 不同，这是用户级别的 token
 */
async function verifyUserMcpToken(token: string): Promise<AuthResult> {
  try {
    // Token 格式：cmu_<random>
    if (!token.startsWith('cmu_')) {
      return { authenticated: false, error: '无效的 Token 格式' };
    }

    // 计算 token hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // 查询 token
    const [tokenRecord] = await db
      .select({
        id: userMcpTokens.id,
        userId: userMcpTokens.userId,
        status: userMcpTokens.status,
      })
      .from(userMcpTokens)
      .where(eq(userMcpTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord) {
      return { authenticated: false, error: '无效的 Token' };
    }

    if (tokenRecord.status !== 'active') {
      return { authenticated: false, error: 'Token 已被撤销' };
    }

    // 更新最后使用时间
    await db
      .update(userMcpTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(userMcpTokens.id, tokenRecord.id));

    // 查询用户信息
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    if (!user) {
      return { authenticated: false, error: 'Token 关联的用户不存在' };
    }

    return {
      authenticated: true,
      userId: user.id,
      userRole: user.role as 'admin' | 'member' | 'viewer',
      userName: user.name,
      userEmail: user.email,
      authMethod: 'user-mcp-token',
    };
  } catch (error) {
    console.error('[API-AUTH] User MCP Token verification failed:', error);
    return { authenticated: false, error: 'Token 验证失败' };
  }
}

// ============================================================
// 统一认证函数
// ============================================================

/**
 * 认证 API 请求
 * 优先级：Bearer Token > Session Cookie
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // 1. 检查 Bearer Token
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      // User MCP Token (cmu_xxx)
      if (token.startsWith('cmu_')) {
        return verifyUserMcpToken(token);
      }
      // 其他 Bearer Token 格式（如未来扩展）
      return { authenticated: false, error: '不支持的 Token 格式' };
    }
  }

  // 2. 检查 Session Cookie
  return getSessionUser();
}

// ============================================================
// API 保护中间件（供 middleware.ts 使用）
// ============================================================

/**
 * 检查 API 请求是否需要认证
 * 返回 true 表示需要认证
 */
export function requiresAuth(pathname: string, method: string): boolean {
  // 公开 API 无需认证
  if (isPublicApi(pathname)) {
    return false;
  }

  // 特殊认证 API 有独立机制
  if (isSpecialAuthApi(pathname)) {
    return false;
  }

  // 只读可选认证 API 的 GET 请求无需认证
  if (isReadOptionalApi(pathname) && method === 'GET') {
    return false;
  }

  // 其他 API 需要认证
  return true;
}

/**
 * 创建 401 未认证响应
 */
export function createUnauthorizedResponse(message: string = '未登录或登录已过期'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="TeamClaw API"',
      },
    }
  );
}

/**
 * 创建 403 权限不足响应
 */
export function createForbiddenResponse(message: string = '权限不足'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

// ============================================================
// Route Handler 辅助函数
// ============================================================

/**
 * 用于 Route Handler 中快速检查认证
 * 
 * 用法：
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuthOrFail(request);
 *   if (!auth.success) return auth.response;
 *   
 *   // auth.user 包含用户信息
 *   console.log(auth.user.userId);
 * }
 * ```
 */
export async function requireAuthOrFail(
  request: NextRequest
): Promise<
  | { success: true; user: AuthResult }
  | { success: false; response: NextResponse }
> {
  const auth = await authenticateRequest(request);

  if (!auth.authenticated) {
    return {
      success: false,
      response: createUnauthorizedResponse(auth.error),
    };
  }

  return { success: true, user: auth };
}

/**
 * 要求管理员权限
 */
export async function requireAdminOrFail(
  request: NextRequest
): Promise<
  | { success: true; user: AuthResult }
  | { success: false; response: NextResponse }
> {
  const authResult = await requireAuthOrFail(request);
  
  if (!authResult.success) {
    return authResult;
  }

  if (authResult.user.userRole !== 'admin') {
    return {
      success: false,
      response: createForbiddenResponse('需要管理员权限'),
    };
  }

  return authResult;
}

/**
 * 验证 session cookie（用于 SSE 等特殊场景）
 * 
 * @param sessionCookie - session cookie 值
 * @param _request - 可选的请求对象（预留扩展）
 */
export async function verifyAuth(
  sessionCookie: string | null,
  _request: NextRequest | null
): Promise<AuthResult> {
  if (!sessionCookie) {
    return { authenticated: false, error: '未登录' };
  }

  try {
    const { valid, userId, expired } = verifySessionToken(sessionCookie);

    if (!valid) {
      return { 
        authenticated: false, 
        error: expired ? '登录已过期，请重新登录' : '无效的会话' 
      };
    }

    if (!userId) {
      return { authenticated: false, error: '会话数据异常' };
    }

    // 查询用户信息
    const user = await getUserById(userId);
    if (!user) {
      return { authenticated: false, error: '用户不存在' };
    }

    return {
      authenticated: true,
      userId: user.id,
      userRole: user.role as 'admin' | 'member' | 'viewer',
      userName: user.name,
      userEmail: user.email,
      authMethod: 'session',
    };
  } catch (error) {
    console.error('[API-AUTH] verifyAuth failed:', error);
    return { authenticated: false, error: '认证服务异常' };
  }
}
