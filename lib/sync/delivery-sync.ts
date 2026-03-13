/**
 * 交付同步：Markdown ↔ 文档交付
 */

import { db } from '@/db';
import { tasks, deliveries } from '@/db/schema';
import type { Delivery } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateDeliveryId, normalizeId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { getMembers, memberNameToId } from './shared';
import type { SyncType } from './shared';

// ============================================================
// 类型
// ============================================================

interface ParsedDelivery {
  title: string;
  memberName: string;
  platform: string;
  link?: string;
  taskTitle?: string;
  version: number;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_needed';
  reviewerName?: string;
  reviewComment?: string;
}

// ============================================================
// 解析 (Markdown → Data)
// ============================================================

export function parseDeliveriesFromMarkdown(body: string): ParsedDelivery[] {
  const result: ParsedDelivery[] = [];
  const lines = body.split('\n');
  let currentStatus: ParsedDelivery['status'] = 'pending';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim();
      if (heading.includes('待审核') || heading.includes('pending')) {
        currentStatus = 'pending';
      } else if (heading.includes('已通过') || heading.includes('approved')) {
        currentStatus = 'approved';
      } else if (heading.includes('驳回') || heading.includes('rejected')) {
        currentStatus = 'rejected';
      } else if (heading.includes('修改') || heading.includes('revision')) {
        currentStatus = 'revision_needed';
      }
      continue;
    }

    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch) {
      const parts = listMatch[1].split('|').map(s => s.trim());
      if (parts.length < 3) continue;

      if (currentStatus === 'pending') {
        result.push({
          title: parts[0],
          memberName: parts[1] || '',
          platform: parsePlatform(parts[2] || ''),
          link: parts[3] || undefined,
          taskTitle: parts[4] || undefined,
          version: parseVersion(parts[5]),
          description: parts[6] || undefined,
          status: currentStatus,
        });
      } else {
        result.push({
          title: parts[0],
          memberName: parts[1] || '',
          platform: 'other',
          reviewerName: parts[2] || undefined,
          reviewComment: parts[3] || undefined,
          version: parseVersion(parts[4]),
          status: currentStatus,
        });
      }
    }
  }
  return result;
}

function parsePlatform(s: string): string {
  const map: Record<string, string> = {
    '腾讯文档': 'tencent-doc', 'tencent-doc': 'tencent-doc',
    '飞书': 'feishu', 'feishu': 'feishu',
    'notion': 'notion',
    '本地': 'local', 'local': 'local',
  };
  return map[s.toLowerCase()] || 'other';
}

function parseVersion(s?: string): number {
  if (!s) return 1;
  const match = s.match(/v?(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}

// ============================================================
// 序列化 (Data → Markdown)
// ============================================================

export async function serializeDeliveries(allDeliveries: Delivery[]): Promise<string> {
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: teamclaw:deliveries');
  lines.push('---');
  lines.push('');
  lines.push('# 文档交付中心');
  lines.push('');

  const membersList = await getMembers();
  const nameMap = new Map(membersList.map(m => [m.id, m.name]));

  const allTasks = await db.select({ id: tasks.id, title: tasks.title }).from(tasks);
  const taskMap = new Map(allTasks.map(t => [t.id, t.title]));

  const pending = allDeliveries.filter(d => d.status === 'pending');
  const approved = allDeliveries.filter(d => d.status === 'approved');
  const rejected = allDeliveries.filter(d => d.status === 'rejected' || d.status === 'revision_needed');

  if (pending.length > 0) {
    lines.push('## 待审核');
    lines.push('');
    for (const d of pending) {
      const member = nameMap.get(d.memberId) || d.memberId;
      const platform = { 'tencent-doc': '腾讯文档', 'feishu': '飞书', 'notion': 'Notion', 'local': '本地', 'other': '其他' }[d.platform] || d.platform;
      const link = d.documentId ? `doc:${d.documentId}` : (d.externalUrl || '');
      const taskTitle = d.taskId ? (taskMap.get(d.taskId) || '') : '';
      lines.push(`- ${d.title} | ${member} | ${platform} | ${link} | ${taskTitle} | v${d.version || 1} | ${d.description || ''}`);
    }
    lines.push('');
  }

  if (approved.length > 0) {
    lines.push('## 已通过');
    lines.push('');
    for (const d of approved) {
      const member = nameMap.get(d.memberId) || d.memberId;
      const reviewer = d.reviewerId ? (nameMap.get(d.reviewerId) || d.reviewerId) : '';
      lines.push(`- ${d.title} | ${member} | ${reviewer} | ${d.reviewComment || ''} | v${d.version || 1}`);
    }
    lines.push('');
  }

  if (rejected.length > 0) {
    lines.push('## 已驳回 / 需修改');
    lines.push('');
    for (const d of rejected) {
      const member = nameMap.get(d.memberId) || d.memberId;
      const reviewer = d.reviewerId ? (nameMap.get(d.reviewerId) || d.reviewerId) : '';
      lines.push(`- ${d.title} | ${member} | ${reviewer} | ${d.reviewComment || ''} | v${d.version || 1}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 同步：Markdown → 数据库
// ============================================================

export async function syncDeliveries(documentId: string, body: string): Promise<{ synced: boolean; type: SyncType; counts: Record<string, number> }> {
  const parsed = parseDeliveriesFromMarkdown(body);
  const counts = { created: 0, updated: 0 };

  const existingDeliveries = await db.select().from(deliveries);
  const existingMap = new Map(existingDeliveries.map(d => [`${d.title}:v${d.version || 1}`, d]));

  for (const p of parsed) {
    const key = `${p.title}:v${p.version}`;
    const existing = existingMap.get(key);
    const memberId = p.memberName ? (await memberNameToId(p.memberName)) : null;

    if (existing) {
      const updateData: Record<string, unknown> = { updatedAt: new Date(), status: p.status };
      if (p.reviewerName) {
        const reviewerId = await memberNameToId(p.reviewerName);
        if (reviewerId) updateData.reviewerId = reviewerId;
      }
      if (p.reviewComment) updateData.reviewComment = p.reviewComment;
      if (p.description) updateData.description = p.description;

      await db.update(deliveries).set(updateData).where(eq(deliveries.id, existing.id));
      eventBus.emit({ type: 'delivery_update', resourceId: existing.id });
      counts.updated++;
    } else if (memberId) {
      const now = new Date();
      const newId = generateDeliveryId();
      let documentRefId: string | null = null;
      let externalUrl: string | null = null;

      if (p.link) {
        if (p.link.startsWith('doc:')) {
          documentRefId = normalizeId(p.link.slice(4));
        } else if (p.link.startsWith('http')) {
          externalUrl = p.link;
        }
      }

      let taskId: string | null = null;
      if (p.taskTitle) {
        const [t] = await db.select({ id: tasks.id }).from(tasks)
          .where(sql`lower(${tasks.title}) = ${p.taskTitle.toLowerCase()}`);
        if (t) taskId = t.id;
      }

      await db.insert(deliveries).values({
        id: newId,
        memberId,
        taskId,
        documentId: documentRefId,
        title: p.title,
        description: p.description || null,
        platform: p.platform as any,
        externalUrl,
        status: p.status,
        version: p.version,
        createdAt: now,
        updatedAt: now,
      } as any);
      eventBus.emit({ type: 'delivery_update', resourceId: newId });
      counts.created++;
    }
  }

  return { synced: true, type: 'teamclaw:deliveries', counts };
}
