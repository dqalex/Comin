/**
 * Skill 快照定时任务调度器
 * 
 * 定期抓取所有 Agent 的 Skill 列表进行安全审计：
 * - 检测未知来源 Skill
 * - 发现未信任 Skill
 * - 识别敏感 Skill
 * 
 * 默认间隔：6 小时
 */

import { db } from '@/db';
import { skillSnapshots, skills, members } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { getServerGatewayClient } from '@/lib/server-gateway-client';
import { RPC_METHODS } from '@/lib/rpc-methods';

// 使用 globalThis 存储定时器，防止 HMR 重复创建
const SCHEDULER_KEY = '__teamclaw_skill_snapshot_timer__';

interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null;
  intervalHours: number;
  isRunning: boolean;
}

function getSchedulerState(): SchedulerState {
  const g = globalThis as Record<string, unknown>;
  if (!g[SCHEDULER_KEY]) {
    g[SCHEDULER_KEY] = {
      timer: null,
      intervalHours: 6,
      isRunning: false,
    };
  }
  return g[SCHEDULER_KEY] as SchedulerState;
}

/**
 * 启动 Skill 快照定时任务
 * @param intervalHours 间隔小时数，默认 6 小时
 */
export function startSkillSnapshotScheduler(intervalHours: number = 6): void {
  const state = getSchedulerState();
  
  // 如果已存在且间隔相同，跳过
  if (state.timer && state.intervalHours === intervalHours) {
    console.log(`[SkillSnapshot] Scheduler already running with interval ${intervalHours}h`);
    return;
  }
  
  // 如果已存在但间隔不同，先停止旧的
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  
  // 校验间隔范围：1-168 小时（1 小时到 1 周）
  const safeInterval = Math.max(1, Math.min(168, intervalHours));
  const intervalMs = safeInterval * 60 * 60 * 1000;
  
  // 立即执行一次
  executeSkillSnapshot().catch(err => {
    console.error('[SkillSnapshot] Initial snapshot failed:', err);
  });
  
  // 设置定时器
  state.timer = setInterval(async () => {
    if (!state.isRunning) {
      await executeSkillSnapshot();
    }
  }, intervalMs);
  
  state.intervalHours = safeInterval;
  
  console.log(`[SkillSnapshot] Scheduler started: interval=${safeInterval}h`);
}

/**
 * 停止 Skill 快照定时任务
 */
export function stopSkillSnapshotScheduler(): void {
  const state = getSchedulerState();
  
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
    console.log('[SkillSnapshot] Scheduler stopped');
  }
}

/**
 * 获取调度器状态
 */
export function getSkillSnapshotSchedulerStatus(): {
  running: boolean;
  intervalHours: number;
  isCapturing: boolean;
} {
  const state = getSchedulerState();
  return {
    running: state.timer !== null,
    intervalHours: state.intervalHours,
    isCapturing: state.isRunning,
  };
}

/**
 * 执行 Skill 快照抓取
 */
export async function executeSkillSnapshot(): Promise<{
  success: boolean;
  captured: number;
  totalAgents: number;
  riskAlerts: number;
  error?: string;
}> {
  const state = getSchedulerState();
  
  if (state.isRunning) {
    console.log('[SkillSnapshot] Already capturing, skipping...');
    return {
      success: false,
      captured: 0,
      totalAgents: 0,
      riskAlerts: 0,
      error: 'Already capturing',
    };
  }
  
  state.isRunning = true;
  
  try {
    const gateway = getServerGatewayClient();
    
    if (!gateway || !gateway.isConnected) {
      console.log('[SkillSnapshot] Server Gateway not connected, skipping');
      return {
        success: false,
        captured: 0,
        totalAgents: 0,
        riskAlerts: 0,
        error: 'Server Gateway not connected',
      };
    }
    
    // 1. 获取所有 AI Agent
    const aiMembers = await db
      .select()
      .from(members)
      .where(eq(members.type, 'ai'));
    
    if (aiMembers.length === 0) {
      console.log('[SkillSnapshot] No AI agents found');
      return {
        success: true,
        captured: 0,
        totalAgents: 0,
        riskAlerts: 0,
      };
    }
    
    // 2. 获取所有 Agent 的 Skill 列表
    const agentsResult = await gateway.request<{ agents: Array<{ id: string; name?: string; identity?: { name?: string } }> }>(
      RPC_METHODS.AGENTS_LIST
    );
    const agents = agentsResult.agents || [];
    
    if (agents.length === 0) {
      console.log('[SkillSnapshot] No agents found in Gateway');
      return {
        success: true,
        captured: 0,
        totalAgents: 0,
        riskAlerts: 0,
      };
    }
    
    // 3. 获取已注册的技能（用于风险检测）
    const registeredSkills = await db.select().from(skills);
    const registeredKeys = new Set(registeredSkills.map(s => s.skillKey));
    const untrustedKeys = new Set(
      registeredSkills.filter(s => s.trustStatus === 'untrusted').map(s => s.skillKey)
    );
    const sensitiveKeys = new Set(
      registeredSkills.filter(s => s.isSensitive).map(s => s.skillKey)
    );
    
    const now = new Date();
    let capturedCount = 0;
    let totalRiskAlerts = 0;
    
    // 4. 为每个 Agent 创建快照
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
        
        totalRiskAlerts += riskAlerts.length;
        
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
          snapshotAt: now,
          skills: skillsData,
          diff,
          riskAlerts: riskAlerts.length > 0 ? riskAlerts : null,
          createdAt: now,
        });
        
        capturedCount++;
        
        // 如果有风险，为未知 Skill 创建记录
        for (const alert of riskAlerts) {
          if (alert.type === 'unknown_skill') {
            // 检查是否已存在
            const existing = registeredSkills.find(s => s.skillKey === alert.skillKey);
            if (!existing) {
              await db.insert(skills).values({
                id: generateId(),
                skillKey: alert.skillKey,
                name: alert.skillKey.split('.').pop() || alert.skillKey,
                description: 'Auto-discovered from Agent',
                version: '1.0.0',
                category: 'custom',
                source: 'unknown',
                trustStatus: 'pending',
                isSensitive: false,
                status: 'active',
                discoveredAt: now,
                createdAt: now,
                updatedAt: now,
              }).catch(() => {
                // 忽略重复键错误
              });
            }
          }
        }
        
      } catch (agentErr) {
        console.error(`[SkillSnapshot] Failed to snapshot agent ${agent.id}:`, agentErr);
      }
    }
    
    console.log(`[SkillSnapshot] Captured ${capturedCount}/${agents.length} agents, ${totalRiskAlerts} risk alerts`);
    
    return {
      success: true,
      captured: capturedCount,
      totalAgents: agents.length,
      riskAlerts: totalRiskAlerts,
    };
    
  } catch (error) {
    console.error('[SkillSnapshot] Snapshot failed:', error);
    return {
      success: false,
      captured: 0,
      totalAgents: 0,
      riskAlerts: 0,
      error: String(error),
    };
  } finally {
    state.isRunning = false;
  }
}
