/**
 * MCP Handler: 定时任务操作
 */

import { db } from '@/db';
import { scheduledTasks, scheduledTaskHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateScheduleId } from '@/lib/id';
import { resolveAIMemberId } from '@/core/member-resolver';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';

/** 获取 CoMind 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建定时任务访问链接 */
function buildScheduleUrl(scheduleId: string): string {
  return `${getBaseUrl()}/schedule?task=${scheduleId}`;
}

export async function handleCreateSchedule(params: Record<string, unknown>) {
  const { title, task_type, schedule_type, schedule_time, schedule_days, description, config } = params as {
    title: string;
    task_type: 'report' | 'summary' | 'backup' | 'notification' | 'custom';
    schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
    schedule_time?: string;
    schedule_days?: number[];
    description?: string;
    config?: Record<string, unknown>;
  };
  
  const member_id = params.member_id as string | undefined;
  const resolved = await resolveAIMemberId(member_id);
  if ('error' in resolved) return { success: false, error: resolved.error };
  const targetMemberId = resolved.memberId;
  
  const now = new Date();
  const [hours = 0, minutes = 0] = (schedule_time || '08:00').split(':').map(Number);
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  
  const id = generateScheduleId();
  await db.insert(scheduledTasks).values({
    id,
    memberId: targetMemberId,
    title,
    description: description || null,
    taskType: task_type,
    scheduleType: schedule_type,
    scheduleTime: schedule_time || null,
    scheduleDays: schedule_days || null,
    nextRunAt: next,
    config: config || {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  
  eventBus.emit({ type: 'schedule_update', resourceId: id });
  triggerMarkdownSync('comind:schedules');
  return { 
    success: true, 
    data: { 
      id, 
      title, 
      url: buildScheduleUrl(id),
      nextRunAt: next, 
      message: `定时任务「${title}」已创建` 
    } 
  };
}

export async function handleListSchedules(params: Record<string, unknown>) {
  const { member_id, enabled_only } = params as { member_id?: string; enabled_only?: boolean };
  
  let allTasks = await db.select().from(scheduledTasks);
  
  if (member_id) {
    allTasks = allTasks.filter(t => t.memberId === member_id);
  }
  if (enabled_only) {
    allTasks = allTasks.filter(t => t.enabled);
  }
  
  return { 
    success: true, 
    data: allTasks.map(t => ({
      id: t.id, title: t.title, taskType: t.taskType,
      scheduleType: t.scheduleType, scheduleTime: t.scheduleTime,
      nextRunAt: t.nextRunAt, enabled: t.enabled,
      url: buildScheduleUrl(t.id),
    }))
  };
}

export async function handleDeleteSchedule(params: Record<string, unknown>) {
  const { schedule_id } = params as { schedule_id: string };
  const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, schedule_id));
  if (!existing) return { success: false, error: '定时任务不存在' };
  
  // 先删除执行历史（问题 #4：FK 级联）
  await db.delete(scheduledTaskHistory).where(eq(scheduledTaskHistory.scheduledTaskId, schedule_id));
  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, schedule_id));
  eventBus.emit({ type: 'schedule_update', resourceId: schedule_id });
  triggerMarkdownSync('comind:schedules');
  return { success: true, data: { message: '定时任务已删除' } };
}

export async function handleUpdateSchedule(params: Record<string, unknown>) {
  const { schedule_id, title, schedule_time, schedule_days, enabled, description } = params as {
    schedule_id: string;
    title?: string;
    schedule_time?: string;
    schedule_days?: number[];
    enabled?: boolean;
    description?: string;
  };

  const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, schedule_id));
  if (!existing) return { success: false, error: '定时任务不存在' };

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updateData.title = title;
  if (schedule_time !== undefined) updateData.scheduleTime = schedule_time;
  if (schedule_days !== undefined) updateData.scheduleDays = schedule_days;
  if (enabled !== undefined) updateData.enabled = enabled;
  if (description !== undefined) updateData.description = description;

  if (schedule_time) {
    const now = new Date();
    const [hours = 0, minutes = 0] = schedule_time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    updateData.nextRunAt = next;
  }

  await db.update(scheduledTasks).set(updateData).where(eq(scheduledTasks.id, schedule_id));

  eventBus.emit({ type: 'schedule_update', resourceId: schedule_id });
  triggerMarkdownSync('comind:schedules');
  return { success: true, data: { schedule_id, message: '定时任务已更新' } };
}
