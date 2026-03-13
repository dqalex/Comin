/**
 * 用户管理 API
 * GET /api/users - 获取用户列表（仅管理员）
 * POST /api/users - 创建用户（仅管理员）
 */

import { db } from '@/db';
import { users, type NewUser } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { desc, eq, like, or, sql } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { generateId } from '@/lib/id';
import { withAdminAuth } from '@/lib/with-auth';
import { successResponse, errorResponse, ApiErrors } from '@/lib/api-route-factory';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/users - 获取用户列表
 * 支持参数：
 * - page: 页码（默认 1）
 * - limit: 每页数量（默认 20，最大 100）
 * - search: 搜索关键词（匹配邮箱或用户名）
 * - role: 角色筛选
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const { searchParams } = new URL(request.url);
    const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
    const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
    const page = pageRaw > 0 ? Math.max(1, pageRaw) : 1;
    const limit = limitRaw > 0 ? Math.min(100, Math.max(1, limitRaw)) : 20;
    const search = searchParams.get('search')?.trim();
    const role = searchParams.get('role');

    // 构建查询条件
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.name, `%${search}%`)
        )
      );
    }
    
    if (role && ['admin', 'member', 'viewer'].includes(role)) {
      conditions.push(eq(users.role, role as 'admin' | 'member' | 'viewer'));
    }

    // 查询总数
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    
    if (conditions.length > 0) {
      void countQuery.where(conditions.length === 1 ? conditions[0] : sql`${conditions.join(' AND ')}`);
    }
    
    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    // 查询用户列表
    const offset = (page - 1) * limit;
    let query = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        role: users.role,
        teamId: users.teamId,
        emailVerified: users.emailVerified,
        preferences: users.preferences,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      // @ts-expect-error Drizzle ORM 类型问题
      query = query.where(conditions.length === 1 ? conditions[0] : sql`${conditions.join(' AND ')}`);
    }

    const userList = await query;

    return successResponse({
      data: userList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

  } catch (error) {
    console.error(`[GET /api/users] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to get user list'), requestId);
  }
});

/**
 * POST /api/users - 创建用户（管理员创建）
 */
export const POST = withAdminAuth(async (request) => {
  try {
    const body = await request.json();
    const { email, name, password, role = 'member' } = body;

    // 参数校验
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
    }
    
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // 检查邮箱是否已存在
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // 创建用户
    const now = new Date();
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    
    const newUser: NewUser = {
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: role as 'admin' | 'member' | 'viewer',
      passwordHash,
      emailVerified: false,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(users).values(newUser);

    // 返回结果（不包含敏感字段）
    const { passwordHash: _, ...safeUser } = newUser;
    
    return NextResponse.json(safeUser, { status: 201 });

  } catch (error) {
    console.error('[Users POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
});
