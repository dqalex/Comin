/**
 * Skill 信任管理 API
 * 
 * POST /api/skills/[id]/trust - 信任 Skill（管理员）
 * 
 * 权限：仅管理员
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, skillTrustRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/[id]/trust - 信任 Skill
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    // 仅管理员可操作
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can trust skills' },
        { status: 403 }
      );
    }
    
    const { id } = await context!.params;
    const body = await request.json();
    const { agentId, note } = body;
    
    // 检查 Skill 是否存在
    const skill = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (skill.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skillData = skill[0];
    const now = new Date();
    
    // 创建信任记录
    const recordId = generateId();
    
    await db.insert(skillTrustRecords).values({
      id: recordId,
      skillId: id,
      agentId: agentId || 'global',
      action: 'trust',
      note: note || null,
      operatedBy: auth.userId!,
      operatedAt: now,
    });
    
    // 更新 Skill 的信任状态（仅全局信任）
    if (!agentId) {
      await db
        .update(skills)
        .set({
          trustStatus: 'trusted',
          source: skillData.source === 'unknown' ? 'external' : skillData.source,
          updatedAt: now,
        })
        .where(eq(skills.id, id));
    }
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { trustStatus: 'trusted', agentId: agentId || 'global' },
    });
    
    return NextResponse.json({
      data: {
        success: true,
        skillId: id,
        trustStatus: 'trusted',
        isGlobal: !agentId,
      },
      message: agentId
        ? `Skill trusted for agent ${agentId}`
        : 'Skill globally trusted',
    });
    
  } catch (error) {
    console.error('Error trusting skill:', error);
    return NextResponse.json(
      { error: 'Failed to trust skill' },
      { status: 500 }
    );
  }
});
