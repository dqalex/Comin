/**
 * 单个用户管理 API
 * GET /api/users/[id] - 获取用户详情
 * PUT /api/users/[id] - 更新用户信息
 * DELETE /api/users/[id] - 删除用户
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { getUserById } from '@/lib/auth';
import { withAuth, withAdminAuth, type RouteContext } from '@/lib/with-auth';

/**
 * GET /api/users/[id] - 获取用户详情
 */
export const GET = withAuth<{ id: string }>(async (_request, auth, context) => {
  try {
    const { id } = await context!.params;
    
    // 非管理员只能查看自己的信息
    if (auth.userRole !== 'admin' && auth.userId !== id) {
      return NextResponse.json({ error: 'No permission to view other user information' }, { status: 403 });
    }

    const targetUser = await getUserById(id);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 返回用户信息（不包含敏感字段）
    const { passwordHash, lockedUntil, ...safeUser } = targetUser;

    return NextResponse.json(safeUser);

  } catch (error) {
    console.error('[Users GET] Error:', error);
    return NextResponse.json({ error: 'Failed to get user information' }, { status: 500 });
  }
});

/**
 * PUT /api/users/[id] - 更新用户信息
 */
export const PUT = withAuth<{ id: string }>(async (request, auth, context) => {
  try {
    const { id } = await context!.params;
    const isAdmin = auth.userRole === 'admin';
    const isSelf = auth.userId === id;
    
    // 非管理员只能更新自己的信息
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'No permission to update other user information' }, { status: 403 });
    }

    // 检查目标用户是否存在
    const targetUser = await getUserById(id);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // 允许更新的字段（按角色）
    const selfAllowedFields = ['name', 'avatar', 'preferences'];
    const adminAllowedFields = ['name', 'avatar', 'role', 'teamId', 'emailVerified', 'preferences'];
    const allowedFields = isAdmin ? adminAllowedFields : selfAllowedFields;
    
    // 过滤更新字段
    const updates: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    
    // 额外校验
    if ('name' in updates) {
      if (typeof updates.name !== 'string' || (updates.name as string).trim().length === 0) {
        return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
      }
      if ((updates.name as string).length > 50) {
        return NextResponse.json({ error: 'Username cannot exceed 50 characters' }, { status: 400 });
      }
      updates.name = (updates.name as string).trim();
    }
    
    if ('role' in updates) {
      if (!['admin', 'member', 'viewer'].includes(updates.role as string)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      // 不能修改自己的角色（防止管理员降级自己）
      if (isSelf) {
        return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // 执行更新
    updates.updatedAt = new Date();
    
    await db.update(users).set(updates).where(eq(users.id, id));

    // 返回更新后的用户
    const updatedUser = await getUserById(id);
    
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const { passwordHash, lockedUntil, ...safeUser } = updatedUser;
    
    return NextResponse.json(safeUser);

  } catch (error) {
    console.error('[Users PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update user information' }, { status: 500 });
  }
});

/**
 * DELETE /api/users/[id] - 删除用户（仅管理员）
 */
export const DELETE = withAdminAuth<{ id: string }>(async (_request, auth, context) => {
  try {
    const { id } = await context!.params;
    
    // 不能删除自己
    if (auth.userId === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // 检查目标用户是否存在
    const targetUser = await getUserById(id);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 删除用户（关联的 userMcpTokens 会通过 onDelete: 'cascade' 自动删除）
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ message: 'User deleted' });

  } catch (error) {
    console.error('[Users DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
});
