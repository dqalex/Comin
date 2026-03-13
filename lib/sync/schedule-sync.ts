/**
 * 定时任务同步：Markdown ↔ 定时任务
 */

import { db } from '@/db';
import { scheduledTasks } from '@/db/schema';
import type { ScheduledTask } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateScheduleId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { getMembers, memberNameToId } from './shared';
import type { SyncType } from './shared';

// ============================================================
// 类型
// ============================================================

interface ParsedSchedule {
  title: string;
  taskType: string;
  scheduleType: string;
  scheduleTime?: string;
  scheduleDays?: number[];
  memberName?: string;
  description?: string;
  enabled: boolean;
}

// ============================================================
// 解析 (Markdown → Data)
// ============================================================

export function parseSchedulesFromMarkdown(body: string): ParsedSchedule[] {
  const result: ParsedSchedule[] = [];
  const lines = body.split('\n');
  let enabled = true;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim();
      if (heading.includes('停用') || heading.includes('禁用') || heading.includes('disabled')) {
        enabled = false;
      } else if (heading.includes('启用') || heading.includes('enabled')) {
        enabled = true;
      }
      continue;
    }

    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch) {
      const parts = listMatch[1].split('|').map(s => s.trim());
      if (parts.length < 3) continue;

      const title = parts[0];
      const taskType = parseTaskType(parts[1] || '');
      const scheduleType = parseScheduleType(parts[2] || '');
      const scheduleTime = parts[3] || undefined;
      const scheduleDays = parts[4] ? parseDaysString(parts[4]) : undefined;
      const memberName = parts[5] || undefined;
      const description = parts[6] || undefined;

      result.push({
        title,
        taskType,
        scheduleType,
        scheduleTime: scheduleTime && scheduleTime.match(/^\d{2}:\d{2}$/) ? scheduleTime : undefined,
        scheduleDays,
        memberName,
        description,
        enabled,
      });
    }
  }
  return result;
}

function parseTaskType(s: string): string {
  const map: Record<string, string> = {
    '报告': 'report', 'report': 'report',
    '汇总': 'summary', 'summary': 'summary',
    '备份': 'backup', 'backup': 'backup',
    '通知': 'notification', 'notification': 'notification',
    '自定义': 'custom', 'custom': 'custom',
  };
  return map[s.toLowerCase()] || 'custom';
}

function parseScheduleType(s: string): string {
  const map: Record<string, string> = {
    '一次': 'once', 'once': 'once',
    '每天': 'daily', '每日': 'daily', 'daily': 'daily',
    '每周': 'weekly', 'weekly': 'weekly',
    '每月': 'monthly', 'monthly': 'monthly',
  };
  return map[s.toLowerCase()] || 'daily';
}

function parseDaysString(s: string): number[] {
  if (s.includes('每天') || s.toLowerCase().includes('everyday')) {
    return [1, 2, 3, 4, 5, 6, 7];
  }

  const dayMap: Record<string, number> = {
    '周一': 1, '周二': 2, '周三': 3, '周四': 4,
    '周五': 5, '周六': 6, '周日': 7, '周天': 7,
    'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4,
    'fri': 5, 'sat': 6, 'sun': 7,
  };

  const rangeMatch = s.match(/(周[一二三四五六日天])(?:~|～|-)(周[一二三四五六日天])/);
  if (rangeMatch) {
    const start = dayMap[rangeMatch[1]] || 1;
    const end = dayMap[rangeMatch[2]] || 5;
    const days: number[] = [];
    for (let d = start; d <= end; d++) days.push(d);
    return days;
  }

  const days: number[] = [];
  for (const [key, val] of Object.entries(dayMap)) {
    if (s.includes(key)) days.push(val);
  }
  return days.length > 0 ? [...new Set(days)].sort() : [];
}

// ============================================================
// 序列化 (Data → Markdown)
// ============================================================

export async function serializeSchedules(allSchedules: ScheduledTask[]): Promise<string> {
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: teamclaw:schedules');
  lines.push('---');
  lines.push('');
  lines.push('# 定时任务管理');
  lines.push('');

  const membersList = await getMembers();
  const nameMap = new Map(membersList.map(m => [m.id, m.name]));

  const enabled = allSchedules.filter(s => s.enabled);
  const disabled = allSchedules.filter(s => !s.enabled);

  if (enabled.length > 0) {
    lines.push('## 已启用');
    lines.push('');
    for (const s of enabled) {
      lines.push(serializeScheduleLine(s, nameMap));
    }
    lines.push('');
  }

  if (disabled.length > 0) {
    lines.push('## 已停用');
    lines.push('');
    for (const s of disabled) {
      lines.push(serializeScheduleLine(s, nameMap));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function serializeScheduleLine(s: ScheduledTask, nameMap: Map<string, string>): string {
  const typeLabel = { report: '报告', summary: '汇总', backup: '备份', notification: '通知', custom: '自定义' }[s.taskType] || s.taskType;
  const schedLabel = { once: '一次', daily: '每天', weekly: '每周', monthly: '每月' }[s.scheduleType] || s.scheduleType;
  const time = s.scheduleTime || '';
  const days = s.scheduleDays ? serializeDays(s.scheduleDays) : '每天';
  const member = nameMap.get(s.memberId) || s.memberId;
  const desc = s.description || '';
  return `- ${s.title} | ${typeLabel} | ${schedLabel} | ${time} | ${days} | ${member} | ${desc}`;
}

function serializeDays(days: number[]): string {
  if (!days || days.length === 0) return '每天';
  if (days.length === 7) return '每天';

  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length > 1) {
    let isRange = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] !== 1) { isRange = false; break; }
    }
    if (isRange) {
      return `${dayNames[sorted[0]]}~${dayNames[sorted[sorted.length - 1]]}`;
    }
  }

  return sorted.map(d => dayNames[d] || `${d}`).join(',');
}

// ============================================================
// 同步：Markdown → 数据库
// ============================================================

export async function syncSchedules(documentId: string, body: string): Promise<{ synced: boolean; type: SyncType; counts: Record<string, number> }> {
  const parsed = parseSchedulesFromMarkdown(body);
  const counts = { created: 0, updated: 0, deleted: 0 };

  const existingSchedules = await db.select().from(scheduledTasks);
  const existingMap = new Map(existingSchedules.map(s => [s.title, s]));

  for (const p of parsed) {
    const existing = existingMap.get(p.title);
    const memberId = p.memberName ? (await memberNameToId(p.memberName)) : null;

    if (existing) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      updateData.taskType = p.taskType;
      updateData.scheduleType = p.scheduleType;
      updateData.enabled = p.enabled;
      if (p.scheduleTime) updateData.scheduleTime = p.scheduleTime;
      if (p.scheduleDays) updateData.scheduleDays = p.scheduleDays;
      if (memberId) updateData.memberId = memberId;
      if (p.description !== undefined) updateData.description = p.description;

      if (p.scheduleTime) {
        const [h = 0, m = 0] = p.scheduleTime.split(':').map(Number);
        const next = new Date();
        next.setHours(h, m, 0, 0);
        if (next <= new Date()) next.setDate(next.getDate() + 1);
        updateData.nextRunAt = next;
      }

      await db.update(scheduledTasks).set(updateData).where(eq(scheduledTasks.id, existing.id));
      eventBus.emit({ type: 'schedule_update', resourceId: existing.id });
      counts.updated++;
    } else {
      if (!memberId) continue;
      const now = new Date();
      const [h = 0, m = 0] = (p.scheduleTime || '08:00').split(':').map(Number);
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);

      const newId = generateScheduleId();
      await db.insert(scheduledTasks).values({
        id: newId,
        memberId,
        title: p.title,
        description: p.description || null,
        taskType: p.taskType as any,
        scheduleType: p.scheduleType as any,
        scheduleTime: p.scheduleTime || null,
        scheduleDays: p.scheduleDays || null,
        nextRunAt: next,
        config: {},
        enabled: p.enabled,
        createdAt: now,
        updatedAt: now,
      });
      eventBus.emit({ type: 'schedule_update', resourceId: newId });
      counts.created++;
    }
  }

  return { synced: true, type: 'teamclaw:schedules', counts };
}
