import { NextResponse } from 'next/server';
import { db, users } from '@/db';
import { sql } from 'drizzle-orm';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * GET /api/init - 检查是否需要初始化
 */
export async function GET() {
  try {
    // 检查是否有用户（不需要 ENABLE_INITIALIZATION 环境变量）
    // 允许在无用户时进行初始化

    // 检查是否有用户
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const hasUsers = (userCount[0]?.count || 0) > 0;

    return NextResponse.json({
      needed: !hasUsers,
      reason: !hasUsers ? 'no_users' : 'has_users',
    });
  } catch (error) {
    console.error('[Init] Failed to check init status:', error);
    return NextResponse.json({ needed: false, error: 'Check failed' }, { status: 500 });
  }
}
