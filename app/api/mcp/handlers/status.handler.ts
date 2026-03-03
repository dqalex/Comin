/**
 * MCP Handler: OpenClaw 状态操作
 */

import { db } from '@/db';
import { openclawStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateStatusId } from '@/lib/id';
import { resolveAIMemberId } from '@/core/member-resolver';
import { eventBus } from '@/lib/event-bus';

export async function handleUpdateStatus(params: Record<string, unknown>) {
  const { member_id, status, current_action, task_id, progress } = params as {
    member_id?: string;
    status: 'idle' | 'working' | 'waiting' | 'offline';
    current_action?: string;
    task_id?: string;
    progress?: number;
  };
  
  const resolved = await resolveAIMemberId(member_id);
  if ('error' in resolved) return { success: false, error: resolved.error };
  const targetMemberId = resolved.memberId;
  
  const [existing] = await db.select().from(openclawStatus).where(eq(openclawStatus.memberId, targetMemberId));
  const now = new Date();
  
  if (existing) {
    const updateData: Record<string, unknown> = { status, updatedAt: now, lastHeartbeat: now };
    if (current_action !== undefined) updateData.currentAction = current_action;
    if (task_id !== undefined) updateData.currentTaskId = task_id;
    if (progress !== undefined) updateData.progress = progress;
    await db.update(openclawStatus).set(updateData).where(eq(openclawStatus.id, existing.id));
  } else {
    await db.insert(openclawStatus).values({
      id: generateStatusId(),
      memberId: targetMemberId,
      status,
      currentAction: current_action || null,
      currentTaskId: task_id || null,
      progress: progress ?? 0,
      interruptible: true,
      createdAt: now,
      updatedAt: now,
      lastHeartbeat: now,
    });
  }
  
  eventBus.emit({ type: 'openclaw_status', resourceId: targetMemberId });
  return { success: true, data: { member_id: targetMemberId, status, message: '状态已更新' } };
}

export async function handleSetQueue(params: Record<string, unknown>) {
  const { member_id, queued_tasks } = params as {
    member_id?: string;
    queued_tasks: Array<{ id: string; title: string }>;
  };
  
  const resolved = await resolveAIMemberId(member_id);
  if ('error' in resolved) return { success: false, error: resolved.error };
  const targetMemberId = resolved.memberId;
  
  const [existing] = await db.select().from(openclawStatus).where(eq(openclawStatus.memberId, targetMemberId));
  const now = new Date();
  
  if (existing) {
    await db.update(openclawStatus).set({ queuedTasks: queued_tasks, updatedAt: now }).where(eq(openclawStatus.id, existing.id));
  } else {
    await db.insert(openclawStatus).values({
      id: generateStatusId(),
      memberId: targetMemberId,
      status: 'idle',
      queuedTasks: queued_tasks,
      interruptible: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  
  eventBus.emit({ type: 'openclaw_status', resourceId: targetMemberId });
  return { success: true, data: { message: `任务队列已设置（${queued_tasks.length} 个任务）` } };
}

export async function handleSetDoNotDisturb(params: Record<string, unknown>) {
  const { member_id, interruptible, reason } = params as {
    member_id?: string;
    interruptible: boolean;
    reason?: string;
  };
  
  const resolved = await resolveAIMemberId(member_id);
  if ('error' in resolved) return { success: false, error: resolved.error };
  const targetMemberId = resolved.memberId;
  
  const [existing] = await db.select().from(openclawStatus).where(eq(openclawStatus.memberId, targetMemberId));
  const now = new Date();
  
  if (existing) {
    await db.update(openclawStatus).set({
      interruptible,
      doNotDisturbReason: reason || null,
      updatedAt: now,
    }).where(eq(openclawStatus.id, existing.id));
  } else {
    await db.insert(openclawStatus).values({
      id: generateStatusId(),
      memberId: targetMemberId,
      status: 'idle',
      interruptible,
      doNotDisturbReason: reason || null,
      createdAt: now,
      updatedAt: now,
    });
  }
  
  eventBus.emit({ type: 'openclaw_status', resourceId: targetMemberId });
  return { 
    success: true, 
    data: { message: interruptible ? '已关闭免打扰模式' : `已开启免打扰模式：${reason || '进行关键操作'}` } 
  };
}
