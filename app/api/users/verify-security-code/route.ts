import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { validateAuth } from '@/lib/auth';
import { verifySecurityCode } from '@/lib/auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * POST /api/users/verify-security-code - 验证安全码（用于敏感操作）
 * 需要管理员权限
 * Body: { securityCode }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    if (!auth.valid || auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { securityCode } = body;

    if (!securityCode) {
      return NextResponse.json({ error: 'Missing securityCode' }, { status: 400 });
    }

    // 获取当前用户的安全码
    const [user] = await db.select({ securityCodeHash: users.securityCodeHash }).from(users).where(eq(users.id, auth.user.id));
    
    // 如果没有设置安全码，直接通过
    if (!user?.securityCodeHash) {
      return NextResponse.json({ verified: true });
    }

    // 验证安全码
    const valid = await verifySecurityCode(securityCode, user.securityCodeHash, auth.user.id);
    
    if (!valid) {
      return NextResponse.json({ verified: false, error: 'Invalid security code' }, { status: 401 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('[SecurityCode] Failed to verify security code:', error);
    return NextResponse.json({ error: 'Failed to verify security code' }, { status: 500 });
  }
}

/**
 * GET /api/users/verify-security-code - 检查是否需要安全码验证
 * 需要管理员权限
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    if (!auth.valid || auth.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查是否设置了安全码
    const [user] = await db.select({ securityCodeHash: users.securityCodeHash }).from(users).where(eq(users.id, auth.user.id));
    
    const hasSecurityCode = !!user?.securityCodeHash;
    
    return NextResponse.json({ required: hasSecurityCode });
  } catch (error) {
    console.error('[SecurityCode] Failed to check security code status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
