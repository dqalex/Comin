/**
 * 管理员重置用户密码 API
 * POST /api/users/[id]/reset-password
 * 
 * 仅管理员可用，为其他用户生成随机密码
 */

import { NextResponse } from 'next/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { withAdminAuth } from '@/lib/with-auth';
import { hashPassword } from '@/lib/auth';

/**
 * 生成随机密码
 * 格式: 12位字母数字混合，包含大小写和数字
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  // 确保至少包含一个大写、一个小写、一个数字
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 25)];
  password += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 25)];
  password += '23456789'[Math.floor(Math.random() * 7)];
  // 填充剩余字符
  for (let i = 3; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * POST /api/users/[id]/reset-password
 * 管理员重置用户密码
 */
export const POST = withAdminAuth<{ id: string }>(async (_request, auth, context) => {
  try {
    const { id } = await context!.params;
    
    // 不能重置自己的密码（应该通过个人设置修改）
    if (auth.userId === id) {
      return NextResponse.json({ 
        error: 'Cannot reset your own password. Use profile settings instead.' 
      }, { status: 400 });
    }

    // 检查目标用户是否存在
    const targetUser = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (!targetUser[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 不能重置其他管理员的密码
    if (targetUser[0].role === 'admin') {
      return NextResponse.json({ 
        error: 'Cannot reset password of another admin user' 
      }, { status: 403 });
    }

    // 生成新密码
    const newPassword = generateRandomPassword();
    
    // 哈希密码（绑定 userId）
    const passwordHash = await hashPassword(newPassword, id);
    
    // 更新数据库
    await db.update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // 返回新密码（仅此一次显示）
    return NextResponse.json({
      success: true,
      newPassword,
      message: 'Password has been reset. Please share the new password with the user securely.',
    });

  } catch (error) {
    console.error('[Reset Password] Error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
});
