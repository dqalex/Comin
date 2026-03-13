import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { validateAuth } from '@/lib/auth';
import { hashSecurityCode, verifyPassword } from '@/lib/auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * PUT /api/users/security-code - 设置或更新安全码
 * 需要管理员权限
 * Body: { currentPassword, securityCode }
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证管理员权限
    const auth = await validateAuth(request);
    if (!auth.valid || auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, securityCode } = body;

    if (!currentPassword || !securityCode) {
      return NextResponse.json({ error: 'Missing currentPassword or securityCode' }, { status: 400 });
    }

    // 验证当前密码
    const [user] = await db.select().from(users).where(eq(users.id, auth.user.id));
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const passwordValid = await verifyPassword(currentPassword, user.passwordHash, auth.user.id);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // 哈希安全码并更新
    const securityCodeHash = await hashSecurityCode(securityCode, auth.user.id);
    await db.update(users)
      .set({ securityCodeHash, updatedAt: new Date() })
      .where(eq(users.id, auth.user.id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[SecurityCode] Failed to set security code:', error);
    return NextResponse.json({ error: error?.message || 'Failed to set security code' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/security-code - 清除安全码
 * 需要管理员权限
 * Body: { currentPassword }
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    if (!auth.valid || auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword } = body;

    if (!currentPassword) {
      return NextResponse.json({ error: 'Missing currentPassword' }, { status: 400 });
    }

    // 验证当前密码
    const [user] = await db.select().from(users).where(eq(users.id, auth.user.id));
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const passwordValid = await verifyPassword(currentPassword, user.passwordHash, auth.user.id);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // 清除安全码
    await db.update(users)
      .set({ securityCodeHash: null, updatedAt: new Date() })
      .where(eq(users.id, auth.user.id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[SecurityCode] Failed to delete security code:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete security code' }, { status: 500 });
  }
}
