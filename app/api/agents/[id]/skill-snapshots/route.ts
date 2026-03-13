/**
 * Agent Skill 快照 API
 * 
 * GET  /api/agents/[id]/skill-snapshots - 获取 Agent 的快照历史
 * POST /api/agents/[id]/skill-snapshots - 抓取当前 Skill 列表快照
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skillSnapshots } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/skill-snapshots - 获取快照历史
 */
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: agentId } = await context!.params;
    
    const snapshots = await db
      .select()
      .from(skillSnapshots)
      .where(eq(skillSnapshots.agentId, agentId))
      .orderBy(desc(skillSnapshots.snapshotAt))
      .limit(20);
    
    return NextResponse.json({
      data: snapshots,
      total: snapshots.length,
    });
    
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/agents/[id]/skill-snapshots - 创建快照
 * 
 * Body: { skills: Array<{ skillKey, name, version?, enabled }> }
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: agentId } = await context!.params;
    const body = await request.json();
    const { skills, diff, riskAlerts } = body;
    
    if (!skills || !Array.isArray(skills)) {
      return NextResponse.json(
        { error: 'skills array is required' },
        { status: 400 }
      );
    }
    
    // 获取上一个快照用于对比
    const lastSnapshot = await db
      .select()
      .from(skillSnapshots)
      .where(eq(skillSnapshots.agentId, agentId))
      .orderBy(desc(skillSnapshots.snapshotAt))
      .limit(1);
    
    const now = new Date();
    const snapshotId = generateId();
    
    // 计算差异（如果没有传入）
    let computedDiff = diff;
    if (!computedDiff && lastSnapshot.length > 0) {
      const lastSkills = lastSnapshot[0].skills || [];
      const lastKeys = new Set(lastSkills.map((s: { skillKey: string }) => s.skillKey));
      const currentKeys = new Set(skills.map((s: { skillKey: string }) => s.skillKey));
      
      computedDiff = {
        added: [...currentKeys].filter(k => !lastKeys.has(k)),
        removed: [...lastKeys].filter(k => !currentKeys.has(k)),
        unchanged: [...currentKeys].filter(k => lastKeys.has(k)),
      };
    }
    
    await db.insert(skillSnapshots).values({
      id: snapshotId,
      agentId,
      snapshotAt: now,
      skills,
      diff: computedDiff,
      riskAlerts: riskAlerts || null,
      createdAt: now,
    });
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_snapshot_created',
      resourceId: snapshotId,
      data: { agentId, skillsCount: skills.length },
    });
    
    return NextResponse.json({
      data: {
        id: snapshotId,
        agentId,
        snapshotAt: now,
        skillsCount: skills.length,
        diff: computedDiff,
      },
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
});
