/**
 * 单个 MCP Token 管理 API
 * GET /api/user-mcp-tokens/[id] - 获取 Token 详情
 * PUT /api/user-mcp-tokens/[id] - 更新 Token（名称、权限、状态）
 * DELETE /api/user-mcp-tokens/[id] - 删除 Token
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { userMcpTokens } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/with-auth';

/**
 * GET /api/user-mcp-tokens/[id] - 获取 Token 详情
 */
export const GET = withAuth<{ id: string }>(async (_request, auth, context) => {
  try {
    const { id } = await context!.params;

    // 查询 Token（必须属于当前用户）
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
      .where(and(
        eq(userMcpTokens.id, id),
        eq(userMcpTokens.userId, auth.userId!)
      ))
      .limit(1);

    if (tokens.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json(tokens[0]);

  } catch (error) {
    console.error('[UserMcpTokens GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch token details' }, { status: 500 });
  }
});

/**
 * PUT /api/user-mcp-tokens/[id] - 更新 Token
 */
export const PUT = withAuth<{ id: string }>(async (request, auth, context) => {
  try {
    const { id } = await context!.params;

    // 检查 Token 是否存在且属于当前用户
    const existing = await db
      .select({ id: userMcpTokens.id })
      .from(userMcpTokens)
      .where(and(
        eq(userMcpTokens.id, id),
        eq(userMcpTokens.userId, auth.userId!)
      ))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // 允许更新的字段
    const allowedFields = ['name', 'permissions', 'status'];
    const updates: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // 字段校验
    if ('name' in updates) {
      if (typeof updates.name !== 'string' || (updates.name as string).length > 100) {
        return NextResponse.json({ error: 'Token name cannot exceed 100 characters' }, { status: 400 });
      }
      updates.name = (updates.name as string).trim();
    }
    
    if ('permissions' in updates) {
      if (!Array.isArray(updates.permissions)) {
        return NextResponse.json({ error: 'permissions must be an array' }, { status: 400 });
      }
    }
    
    if ('status' in updates) {
      if (!['active', 'inactive', 'revoked'].includes(updates.status as string)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // 执行更新
    await db.update(userMcpTokens).set(updates).where(eq(userMcpTokens.id, id));

    // 返回更新后的 Token
    const updated = await db
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
      .where(eq(userMcpTokens.id, id))
      .limit(1);

    return NextResponse.json(updated[0]);

  } catch (error) {
    console.error('[UserMcpTokens PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update token' }, { status: 500 });
  }
});

/**
 * DELETE /api/user-mcp-tokens/[id] - 删除 Token
 */
export const DELETE = withAuth<{ id: string }>(async (_request, auth, context) => {
  try {
    const { id } = await context!.params;

    // 检查 Token 是否存在且属于当前用户
    const existing = await db
      .select({ id: userMcpTokens.id })
      .from(userMcpTokens)
      .where(and(
        eq(userMcpTokens.id, id),
        eq(userMcpTokens.userId, auth.userId!)
      ))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // 删除 Token
    await db.delete(userMcpTokens).where(eq(userMcpTokens.id, id));

    return NextResponse.json({ message: 'Token deleted' });

  } catch (error) {
    console.error('[UserMcpTokens DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
  }
});
