/**
 * Skill 提交审批 API
 * 
 * POST /api/skills/[id]/submit - 提交 Skill 审批（创建者）
 * 
 * 权限：创建者或管理员
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skills, approvalRequests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { generateId } from '@/lib/id';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/[id]/submit - 提交审批
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: RouteContext<{ id: string }>
): Promise<NextResponse> => {
  try {
    const { id } = await context!.params;
    
    // 检查 Skill 是否存在
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    
    const skill = existing[0];
    
    // 权限检查：创建者或管理员
    const isCreator = skill.createdBy === auth.userId;
    const isAdmin = auth.userRole === 'admin';
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: 'Only creator or admin can submit for approval' },
        { status: 403 }
      );
    }
    
    // 状态检查：仅 draft 状态可提交
    if (skill.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft skills can be submitted for approval' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    
    // 更新 Skill 状态
    await db
      .update(skills)
      .set({
        status: 'pending_approval',
        updatedAt: now,
      })
      .where(eq(skills.id, id));
    
    // 创建审批请求
    const approvalId = generateId();
    
    await db.insert(approvalRequests).values({
      id: approvalId,
      type: 'skill_publish',
      resourceType: 'skill',
      resourceId: id,
      requesterId: auth.userId!,
      payload: {
        skillKey: skill.skillKey,
        skillName: skill.name,
        category: skill.category,
      },
      requestNote: 'Submit for approval',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_update',
      resourceId: id,
      data: { status: 'pending_approval', approvalId },
    });
    
    return NextResponse.json({
      data: {
        success: true,
        skillId: id,
        status: 'pending_approval',
        approvalId,
      },
      message: 'Skill submitted for approval',
    });
    
  } catch (error) {
    console.error('Error submitting skill:', error);
    return NextResponse.json(
      { error: 'Failed to submit skill' },
      { status: 500 }
    );
  }
});
