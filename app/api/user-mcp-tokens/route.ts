/**
 * 用户 MCP Token 管理 API
 * GET /api/user-mcp-tokens - 获取当前用户的 Token 列表
 * POST /api/user-mcp-tokens - 创建新 Token
 */

import { db } from '@/db';
import { userMcpTokens, type NewUserMcpToken } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { desc, eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { withAuth } from '@/lib/with-auth';
import { successResponse, errorResponse, ApiErrors } from '@/lib/api-route-factory';
import {
  generateMcpToken,
  hashMcpToken,
  encryptMcpToken,
  maskMcpToken,
} from '@/lib/mcp-token';

/**
 * GET /api/user-mcp-tokens - 获取当前用户的 Token 列表
 */
export const GET = withAuth(async (request: NextRequest, auth) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    // 查询用户的所有 Token（不返回加密内容）
    const tokens = await db
      .select({
        id: userMcpTokens.id,
        name: userMcpTokens.name,
        permissions: userMcpTokens.permissions,
        status: userMcpTokens.status,
        lastUsedAt: userMcpTokens.lastUsedAt,
        expiresAt: userMcpTokens.expiresAt,
        createdAt: userMcpTokens.createdAt,
      })
      .from(userMcpTokens)
      .where(eq(userMcpTokens.userId, auth.userId!))
      .orderBy(desc(userMcpTokens.createdAt));

    return successResponse(tokens);

  } catch (error) {
    console.error(`[GET /api/user-mcp-tokens] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to fetch token list'), requestId);
  }
});

/**
 * POST /api/user-mcp-tokens - 创建新 Token
 * 请求体：
 * - name: Token 名称/备注
 * - permissions: 权限列表（MCP 工具白名单）
 * - expiresAt: 过期时间（可选，ISO 格式）
 */
export const POST = withAuth(async (request, auth) => {
  try {
    const body = await request.json();
    
    const { name = '', permissions = [], expiresAt } = body;

    // 参数校验
    if (typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'Token name cannot exceed 100 characters' }, { status: 400 });
    }
    
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'permissions must be an array' }, { status: 400 });
    }

    // 检查用户的 Token 数量限制（每用户最多 10 个）
    const existingTokens = await db
      .select({ id: userMcpTokens.id })
      .from(userMcpTokens)
      .where(eq(userMcpTokens.userId, auth.userId!));
    
    if (existingTokens.length >= 10) {
      return NextResponse.json({ error: 'Maximum 10 tokens per user' }, { status: 400 });
    }

    // 生成 Token
    const plainToken = generateMcpToken();
    const tokenHash = hashMcpToken(plainToken);
    const encryptedToken = encryptMcpToken(plainToken);

    // 创建记录
    const now = new Date();
    const tokenId = generateId();
    
    const newToken: NewUserMcpToken = {
      id: tokenId,
      userId: auth.userId!,
      tokenHash,
      encryptedToken,
      name: name.trim(),
      permissions: permissions as string[],
      status: 'active',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdAt: now,
    };
    
    await db.insert(userMcpTokens).values(newToken);

    // 返回结果（只在创建时返回明文 Token，之后无法再获取）
    return NextResponse.json({
      id: tokenId,
      token: plainToken,  // 只有这次能看到！
      tokenMasked: maskMcpToken(plainToken),
      name: newToken.name,
      permissions: newToken.permissions,
      status: newToken.status,
      expiresAt: newToken.expiresAt,
      createdAt: newToken.createdAt,
      warning: 'Please save this token securely. It will not be shown again after closing this page!',
    }, { status: 201 });

  } catch (error) {
    console.error('[UserMcpTokens POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
});
