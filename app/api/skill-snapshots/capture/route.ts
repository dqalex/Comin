/**
 * Skill 快照抓取 API
 * 
 * POST /api/skill-snapshots/capture - 从 Gateway 抓取所有 Agent 的 Skill 列表并存快照
 * GET /api/skill-snapshots/capture - 获取最近一次快照统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { skillSnapshots, skills } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { getServerGatewayClient } from '@/lib/server-gateway-client';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { RPC_METHODS } from '@/lib/rpc-methods';

export const dynamic = 'force-dynamic';

/**
 * GET /api/skill-snapshots/capture - 获取快照统计
 */
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult
) => {
  try {
    // 获取最近的快照
    const recentSnapshots = await db
      .select()
      .from(skillSnapshots)
      .orderBy(desc(skillSnapshots.snapshotAt))
      .limit(10);
    
    // 统计
    const stats = {
      totalSnapshots: await db.select({ id: skillSnapshots.id }).from(skillSnapshots).then(r => r.length),
      lastSnapshotAt: recentSnapshots[0]?.snapshotAt || null,
      agentsCount: new Set(recentSnapshots.map(s => s.agentId)).size,
    };
    
    return NextResponse.json({
      data: {
        recentSnapshots,
        stats,
      },
    });
    
  } catch (error) {
    console.error('Error fetching snapshot stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshot stats' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/skill-snapshots/capture - 抓取所有 Agent 的 Skill 快照
 * 
 * 权限：管理员
 */
export const POST = withAuth(async (
  request: NextRequest,
  auth: AuthResult
) => {
  try {
    // 权限检查
    if (auth.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permission required' },
        { status: 403 }
      );
    }
    
    const gateway = getServerGatewayClient();
    
    if (!gateway || !gateway.isConnected) {
      return NextResponse.json(
        { error: 'Server Gateway not connected' },
        { status: 503 }
      );
    }
    
    // 1. 获取所有 Agent 列表
    const agentsResult = await gateway.request<{ agents: Array<{ id: string; name?: string; identity?: { name?: string } }> }>(
      RPC_METHODS.AGENTS_LIST
    );
    const agents = agentsResult.agents || [];
    
    if (agents.length === 0) {
      return NextResponse.json({
        data: { captured: 0, message: 'No agents found' },
      });
    }
    
    // 2. 获取每个 Agent 的 Skill 列表并存储快照
    const now = new Date();
    const capturedSnapshots: Array<{
      agentId: string;
      agentName: string;
      skillsCount: number;
      snapshotId: string;
    }> = [];
    
    // 获取已注册的技能（用于风险检测）
    const registeredSkills = await db.select().from(skills);
    const registeredKeys = new Set(registeredSkills.map(s => s.skillKey));
    const untrustedKeys = new Set(
      registeredSkills.filter(s => s.trustStatus === 'untrusted').map(s => s.skillKey)
    );
    const sensitiveKeys = new Set(
      registeredSkills.filter(s => s.isSensitive).map(s => s.skillKey)
    );
    
    for (const agent of agents) {
      try {
        // 获取 Agent 的 skill 列表
        const skillsResult = await gateway.request<{ skills: Array<{ skillKey: string; name: string; version?: string; disabled?: boolean }> }>(
          RPC_METHODS.SKILLS_STATUS,
          { agentId: agent.id }
        );
        const agentSkills = skillsResult.skills || [];
        
        // 构建快照数据
        const skillsData = agentSkills.map((s: { skillKey: string; name: string; version?: string; disabled?: boolean }) => ({
          skillKey: s.skillKey,
          name: s.name,
          version: s.version,
          enabled: !s.disabled,
        }));
        
        // 计算风险告警
        const riskAlerts: Array<{
          type: 'unknown_skill' | 'untrusted_skill' | 'sensitive_skill';
          skillKey: string;
          message: string;
        }> = [];
        
        for (const skill of agentSkills) {
          if (!registeredKeys.has(skill.skillKey)) {
            riskAlerts.push({
              type: 'unknown_skill',
              skillKey: skill.skillKey,
              message: `Unknown skill not registered in SkillHub`,
            });
          } else if (untrustedKeys.has(skill.skillKey)) {
            riskAlerts.push({
              type: 'untrusted_skill',
              skillKey: skill.skillKey,
              message: `Skill marked as untrusted`,
            });
          } else if (sensitiveKeys.has(skill.skillKey)) {
            riskAlerts.push({
              type: 'sensitive_skill',
              skillKey: skill.skillKey,
              message: `Skill contains sensitive operations`,
            });
          }
        }
        
        // 获取上一个快照用于计算差异
        const lastSnapshot = await db
          .select()
          .from(skillSnapshots)
          .where(eq(skillSnapshots.agentId, agent.id))
          .orderBy(desc(skillSnapshots.snapshotAt))
          .limit(1);
        
        let diff = undefined;
        if (lastSnapshot.length > 0) {
          const lastSkills = lastSnapshot[0].skills || [];
          const lastKeys = new Set(lastSkills.map((s: { skillKey: string }) => s.skillKey));
          const currentKeys = new Set(skillsData.map((s: { skillKey: string }) => s.skillKey));
          
          diff = {
            added: [...currentKeys].filter(k => !lastKeys.has(k)),
            removed: [...lastKeys].filter(k => !currentKeys.has(k)),
            unchanged: [...currentKeys].filter(k => lastKeys.has(k)),
          };
        }
        
        // 创建快照
        const snapshotId = generateId();
        
        await db.insert(skillSnapshots).values({
          id: snapshotId,
          agentId: agent.id,
          agentName: agent.identity?.name || agent.name || agent.id,
          snapshotAt: now,
          skills: skillsData,
          diff,
          riskAlerts: riskAlerts.length > 0 ? riskAlerts : null,
          createdAt: now,
        });
        
        capturedSnapshots.push({
          agentId: agent.id,
          agentName: agent.identity?.name || agent.name || agent.id,
          skillsCount: agentSkills.length,
          snapshotId,
        });
        
      } catch (err) {
        console.error(`Failed to capture skills for agent ${agent.id}:`, err);
      }
    }
    
    // 发送 SSE 事件
    eventBus.emit({
      type: 'skill_snapshots_captured',
      resourceId: 'batch',
      data: { count: capturedSnapshots.length },
    });
    
    return NextResponse.json({
      data: {
        captured: capturedSnapshots.length,
        totalAgents: agents.length,
        snapshots: capturedSnapshots,
        capturedAt: now,
      },
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error capturing snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to capture snapshots' },
      { status: 500 }
    );
  }
});
