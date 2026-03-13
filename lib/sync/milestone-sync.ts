/**
 * 里程碑同步：Markdown ↔ 里程碑
 */

import { db } from '@/db';
import { milestones, projects } from '@/db/schema';
import type { Milestone } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateMilestoneId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import type { SyncType } from './shared';

// ============================================================
// 类型
// ============================================================

interface ParsedMilestone {
  title: string;
  status: Milestone['status'];
  dueDate?: string;
  description?: string;
}

// ============================================================
// 解析常量
// ============================================================

const STATUS_HEADERS: Record<string, Milestone['status']> = {
  '待开始': 'open',
  '未开始': 'open',
  'open': 'open',
  '进行中': 'in_progress',
  'in progress': 'in_progress',
  'in_progress': 'in_progress',
  '已完成': 'completed',
  'completed': 'completed',
  '已取消': 'cancelled',
  'cancelled': 'cancelled',
};

// ============================================================
// 解析 (Markdown → Data)
// ============================================================

export function parseMilestonesFromMarkdown(body: string): ParsedMilestone[] {
  const result: ParsedMilestone[] = [];
  const lines = body.split('\n');
  let currentStatus: Milestone['status'] = 'open';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // ## 标题：匹配状态分区
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim().toLowerCase();
      // 去除 emoji 前缀
      const cleanHeading = heading.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '').trim();

      for (const [keyword, status] of Object.entries(STATUS_HEADERS)) {
        if (cleanHeading.includes(keyword.toLowerCase())) {
          currentStatus = status;
          break;
        }
      }
      continue;
    }

    // 列表项：`- 标题 | 截止日期 | 描述`
    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch) {
      const parts = listMatch[1].split('|').map(s => s.trim());
      if (parts.length === 0 || !parts[0]) continue;

      const title = parts[0];
      const dueDateStr = parts[1] || undefined;
      const description = parts[2] || undefined;

      // 验证截止日期格式
      let dueDate: string | undefined;
      if (dueDateStr && /^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
        dueDate = dueDateStr;
      }

      result.push({
        title,
        status: currentStatus,
        dueDate,
        description,
      });

      // 检查下一行是否为描述（`> 详细说明`）
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim();
        if (nextTrimmed.startsWith('> ')) {
          const descContent = nextTrimmed.slice(2).trim();
          // 如果已有 description（来自管道分隔），追加；否则设置
          const current = result[result.length - 1];
          if (current.description) {
            current.description += '\n' + descContent;
          } else {
            current.description = descContent;
          }
          i++; // 跳过描述行
        }
      }
      continue;
    }
  }

  return result;
}

// ============================================================
// 序列化 (Data → Markdown)
// ============================================================

export function serializeMilestones(allMilestones: Milestone[], projectId?: string): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: teamclaw:milestones');
  if (projectId) lines.push(`project: ${projectId}`);
  lines.push('---');
  lines.push('');

  const groups: { heading: string; status: Milestone['status'] }[] = [
    { heading: '进行中', status: 'in_progress' },
    { heading: '待开始', status: 'open' },
    { heading: '已完成', status: 'completed' },
    { heading: '已取消', status: 'cancelled' },
  ];

  for (const { heading, status } of groups) {
    const filtered = allMilestones.filter(m => m.status === status);
    if (filtered.length === 0) continue;

    lines.push(`## ${heading}`);
    lines.push('');

    for (const m of filtered) {
      const dueStr = m.dueDate ? formatDate(m.dueDate) : '';
      const desc = m.description || '';
      lines.push(`- ${m.title} | ${dueStr} | ${desc}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// 同步：Markdown → 数据库
// ============================================================

export async function syncMilestones(
  documentId: string,
  body: string,
  projectId?: string,
): Promise<{ synced: boolean; type: SyncType; counts: Record<string, number> }> {
  if (!projectId) {
    console.warn(`[milestone-sync] 里程碑同步需要 projectId，跳过文档 ${documentId}`);
    return { synced: false, type: 'teamclaw:milestones', counts: { created: 0, updated: 0, deleted: 0 } };
  }

  const parsed = parseMilestonesFromMarkdown(body);
  const counts = { created: 0, updated: 0, deleted: 0 };

  // 获取当前项目的里程碑
  const existingMilestones = await db.select().from(milestones)
    .where(eq(milestones.projectId, projectId));
  const existingMap = new Map(existingMilestones.map(m => [m.title, m]));
  const parsedTitles = new Set(parsed.map(p => p.title));

  let sortOrder = 0;

  for (const p of parsed) {
    const existing = existingMap.get(p.title);

    if (existing) {
      // 更新已有里程碑
      const updateData: Record<string, unknown> = {
        status: p.status,
        sortOrder: sortOrder++,
        updatedAt: new Date(),
      };
      if (p.description !== undefined) updateData.description = p.description;
      if (p.dueDate) {
        updateData.dueDate = new Date(p.dueDate);
      }

      await db.update(milestones).set(updateData).where(eq(milestones.id, existing.id));
      eventBus.emit({ type: 'milestone_update', resourceId: existing.id });
      counts.updated++;
    } else {
      // 创建新里程碑
      const newId = generateMilestoneId();
      await db.insert(milestones).values({
        id: newId,
        title: p.title,
        description: p.description || null,
        projectId,
        status: p.status,
        dueDate: p.dueDate ? new Date(p.dueDate) : null,
        sortOrder: sortOrder++,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      eventBus.emit({ type: 'milestone_update', resourceId: newId });
      counts.created++;
    }
  }

  // 删除文档中不存在的里程碑
  for (const [title, existing] of existingMap) {
    if (!parsedTitles.has(title)) {
      await db.delete(milestones).where(eq(milestones.id, existing.id));
      eventBus.emit({ type: 'milestone_update', resourceId: existing.id });
      counts.deleted++;
    }
  }

  return { synced: true, type: 'teamclaw:milestones', counts };
}
