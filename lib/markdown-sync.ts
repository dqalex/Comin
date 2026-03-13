/**
 * Markdown 双向同步引擎（门面模块）
 * 
 * 支持 Markdown ↔ 看板数据的双向同步：
 * - 解析（parse）：Markdown → 结构化数据 → 写入数据库
 * - 序列化（serialize）：数据库记录 → Markdown 文本
 * 
 * 支持的文档类型：
 * - teamclaw:tasks      任务看板
 * - teamclaw:schedules  定时任务
 * - teamclaw:deliveries 文档交付
 * - task_list         任务列表（teamclaw:tasks 别名，兼容旧文档）
 * 
 * 实现已拆分到 lib/sync/ 子模块，本文件保持向后兼容的 re-export
 */

import { db } from '@/db';
import { tasks, scheduledTasks, deliveries, milestones, documents, projects, members } from '@/db/schema';
import type { Task, ScheduledTask, Delivery, Milestone } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

// re-export 共享基础设施
export { isDocumentSyncing, invalidateMemberCache } from './sync/shared';
export type { SyncType } from './sync/shared';
import { parseFrontmatter, markSyncing, unmarkSyncingDelayed } from './sync/shared';
import type { SyncType } from './sync/shared';

// re-export 领域同步（供需要细粒度导入的消费者使用）
export { syncTasks, serializeTasks, parseTasksFromMarkdown, patchTaskStatusInMarkdown } from './sync/task-sync';
export { syncSchedules, serializeSchedules, parseSchedulesFromMarkdown } from './sync/schedule-sync';
export { syncDeliveries, serializeDeliveries, parseDeliveriesFromMarkdown } from './sync/delivery-sync';
export { syncMilestones, serializeMilestones, parseMilestonesFromMarkdown } from './sync/milestone-sync';

// 导入领域同步函数（供本模块的聚合函数使用）
import { syncTasks, serializeTasks, patchTaskStatusInMarkdown } from './sync/task-sync';
import { syncSchedules, serializeSchedules } from './sync/schedule-sync';
import { syncDeliveries, serializeDeliveries } from './sync/delivery-sync';
import { syncMilestones, serializeMilestones } from './sync/milestone-sync';

// ============================================================
// 同步：Markdown → 数据库（写入看板）
// ============================================================

export async function syncMarkdownToDatabase(documentId: string, content: string): Promise<{ synced: boolean; type?: SyncType; counts?: Record<string, number> }> {
  const { frontmatter, body } = parseFrontmatter(content);
  if (!frontmatter) return { synced: false };

  // 处理文档 Front Matter 中的交付字段（不限 teamclaw:* 类型，任意 type 均可）
  if (frontmatter.delivery_status) {
    try {
      await syncDeliveryFromDocumentFrontmatter(documentId, frontmatter);
    } catch (err) {
      console.error(`[markdown-sync] 交付同步失败 for doc ${documentId}:`, err);
    }
  }

  switch (frontmatter.type) {
    case 'teamclaw:tasks':
    case 'task_list':  // 兼容旧文档类型
    {
      // 解析 projectId：frontmatter.project 可能是项目名或项目 ID
      let projectId = frontmatter.project;
      if (projectId) {
        // 检查是否是有效的项目 ID（随机字符串格式，如 YZbsND7ShxC）
        // 项目 ID 特征：无连字符、无小写字母、长度 12 左右
        // 项目名特征：可能包含连字符、小写字母、可读性强
        const isLikelyId = /^[A-Z0-9]{10,}$/.test(projectId);
        if (!isLikelyId) {
          // 可能是项目名，尝试查找项目 ID
          const [project] = await db.select({ id: projects.id })
            .from(projects)
            .where(sql`lower(${projects.name}) = ${projectId.toLowerCase()}`);
          if (project) {
            projectId = project.id;
          } else {
            // 项目不存在，不设置 projectId（任务将作为全局任务）
            projectId = undefined;
          }
        }
      }
      return await syncTasks(documentId, body, projectId);
    }
    case 'teamclaw:schedules':
      return await syncSchedules(documentId, body);
    case 'teamclaw:deliveries':
      return await syncDeliveries(documentId, body);
    case 'teamclaw:milestones':
    {
      // 解析 projectId：与 teamclaw:tasks 相同的逻辑
      let milestoneProjectId = frontmatter.project;
      if (milestoneProjectId) {
        const isLikelyId = /^[A-Z0-9]{10,}$/.test(milestoneProjectId);
        if (!isLikelyId) {
          const [project] = await db.select({ id: projects.id })
            .from(projects)
            .where(sql`lower(${projects.name}) = ${milestoneProjectId.toLowerCase()}`);
          if (project) {
            milestoneProjectId = project.id;
          } else {
            milestoneProjectId = undefined;
          }
        }
      }
      return await syncMilestones(documentId, body, milestoneProjectId);
    }
    default:
      // 如果有交付字段但没有同步类型，标记为已同步（交付已处理）
      return { synced: !!frontmatter.delivery_status };
  }
}

// ============================================================
// 同步：数据库 → Markdown（回写文档）
// ============================================================

export async function syncDatabaseToMarkdown(documentId: string): Promise<{ updated: boolean }> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc || !doc.content) return { updated: false };

  const { frontmatter } = parseFrontmatter(doc.content);
  if (!frontmatter) return { updated: false };

  let newContent: string;

  switch (frontmatter.type) {
    case 'teamclaw:tasks':
    case 'task_list':  // 兼容旧文档类型
    {
      // 解析 projectId：frontmatter.project 可能是项目名或项目 ID
      let projectId = frontmatter.project;
      if (projectId) {
        // 项目 ID 特征：无连字符、无小写字母、长度 10+
        const isLikelyId = /^[A-Z0-9]{10,}$/.test(projectId);
        if (!isLikelyId) {
          const [project] = await db.select({ id: projects.id })
            .from(projects)
            .where(sql`lower(${projects.name}) = ${projectId.toLowerCase()}`);
          if (project) projectId = project.id;
          else projectId = undefined;
        }
      }
      
      let projectTasks: Task[];
      if (projectId) {
        projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
      } else {
        const allTasks = await db.select().from(tasks);
        projectTasks = allTasks.filter(t => t.attachments?.includes(`sync:${documentId}`));
      }
      
      // 原地更新：保留文档原有结构和内容，仅更新任务 checkbox 状态
      newContent = patchTaskStatusInMarkdown(doc.content, projectTasks);
      break;
    }
    case 'teamclaw:schedules': {
      const allSchedules = await db.select().from(scheduledTasks);
      newContent = await serializeSchedules(allSchedules);
      break;
    }
    case 'teamclaw:deliveries': {
      const allDeliveries = await db.select().from(deliveries);
      newContent = await serializeDeliveries(allDeliveries);
      break;
    }
    case 'teamclaw:milestones': {
      // 解析 projectId
      let milestoneProjectId = frontmatter.project;
      if (milestoneProjectId) {
        const isLikelyId = /^[A-Z0-9]{10,}$/.test(milestoneProjectId);
        if (!isLikelyId) {
          const [project] = await db.select({ id: projects.id })
            .from(projects)
            .where(sql`lower(${projects.name}) = ${milestoneProjectId.toLowerCase()}`);
          if (project) milestoneProjectId = project.id;
          else milestoneProjectId = undefined;
        }
      }
      if (!milestoneProjectId) return { updated: false };
      const projectMilestones = await db.select().from(milestones)
        .where(eq(milestones.projectId, milestoneProjectId));
      newContent = serializeMilestones(projectMilestones, milestoneProjectId);
      break;
    }
    default:
      return { updated: false };
  }

  // 安全检查：如果序列化结果只有 frontmatter 没有实际内容（任务被全部删除），
  // 不应覆盖原始文档，避免丢失 Agent 编写的完整 Markdown 内容
  const { body: newBody } = parseFrontmatter(newContent);
  const hasActualContent = newBody.trim().length > 0;
  if (!hasActualContent) {
    console.log(`[markdown-sync] 反向同步跳过：文档 ${documentId} 序列化结果无实际内容，保留原始文档`);
    return { updated: false };
  }

  if (newContent.trim() !== doc.content.trim()) {
    markSyncing(documentId);
    try {
      await db.update(documents).set({ content: newContent, updatedAt: new Date() })
        .where(eq(documents.id, documentId));
      eventBus.emit({ type: 'document_update', resourceId: documentId });
    } finally {
      unmarkSyncingDelayed(documentId);
    }
    return { updated: true };
  }

  return { updated: false };
}

// ============================================================
// 查找所有同步文档
// ============================================================

export async function findSyncDocuments(syncType?: SyncType): Promise<{ id: string; type: SyncType }[]> {
  const allDocs = await db.select({ id: documents.id, content: documents.content }).from(documents);
  const results: { id: string; type: SyncType }[] = [];

  // 已知的同步类型
  const validTypes: SyncType[] = ['teamclaw:tasks', 'teamclaw:schedules', 'teamclaw:deliveries', 'teamclaw:milestones', 'task_list'];
  
  // 类型别名映射：task_list 是 teamclaw:tasks 的别名
  const typeAliases: Record<string, SyncType[]> = {
    'teamclaw:tasks': ['teamclaw:tasks', 'task_list'],
    'task_list': ['teamclaw:tasks', 'task_list'],
  };

  for (const doc of allDocs) {
    if (!doc.content) continue;
    const { frontmatter } = parseFrontmatter(doc.content);
    if (frontmatter && validTypes.includes(frontmatter.type as SyncType)) {
      // 使用别名映射来匹配类型
      const docType = frontmatter.type as SyncType;
      const aliases = typeAliases[docType] || [docType];
      const matchTypes = syncType ? (typeAliases[syncType] || [syncType]) : validTypes;
      
      if (!syncType || aliases.some(t => matchTypes.includes(t))) {
        results.push({ id: doc.id, type: docType });
      }
    }
  }
  return results;
}

// ============================================================
// 反向同步触发器：看板变更后回写所有关联的 Markdown 文档
// ============================================================

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function triggerMarkdownSync(syncType: SyncType): void {
  const existing = syncTimers.get(syncType);
  if (existing) clearTimeout(existing);

  syncTimers.set(syncType, setTimeout(async () => {
    syncTimers.delete(syncType);
    try {
      const docs = await findSyncDocuments(syncType);
      for (const doc of docs) {
        await syncDatabaseToMarkdown(doc.id);
      }
    } catch (err) {
      console.error(`[markdown-sync] Failed to sync ${syncType} to markdown:`, err);
    }
  }, 500));
}

// ============================================================
// 从文档 Front Matter 同步交付记录
// ============================================================

import { generateDeliveryId } from '@/lib/id';
import { memberNameToId } from './sync/shared';

interface DeliveryFrontmatter {
  title?: string;
  delivery_status?: 'pending' | 'approved' | 'rejected' | 'revision_needed';
  delivery_assignee?: string;
  delivery_platform?: string;
  delivery_version?: number;
  delivery_reviewer?: string;
  delivery_comment?: string;
  related_tasks?: string[];
}

async function syncDeliveryFromDocumentFrontmatter(
  documentId: string, 
  frontmatter: DeliveryFrontmatter
): Promise<void> {
  if (!frontmatter.delivery_status) return;

  // 获取文档信息
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return;

  // 解析交付者 ID
  let memberId: string | null = null;
  if (frontmatter.delivery_assignee) {
    memberId = await memberNameToId(frontmatter.delivery_assignee);
  }

  // 如果没有指定交付者，查找第一个 AI 成员
  if (!memberId) {
    const [aiMember] = await db.select().from(members).where(eq(members.type, 'ai')).limit(1);
    if (aiMember) {
      memberId = aiMember.id;
    }
  }

  // 如果还是没有，跳过
  if (!memberId) {
    console.warn(`[markdown-sync] Cannot create delivery for document ${documentId}: no assignee`);
    return;
  }

  // 解析审核者 ID
  let reviewerId: string | null = null;
  if (frontmatter.delivery_reviewer) {
    reviewerId = await memberNameToId(frontmatter.delivery_reviewer);
  }

  // 解析关联任务 ID（取第一个，校验 FK 有效性）
  let taskId: string | null = null;
  if (frontmatter.related_tasks && frontmatter.related_tasks.length > 0) {
    const taskRef = frontmatter.related_tasks[0];
    // 先按 ID 精确查找
    const [taskById] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskRef)).limit(1);
    if (taskById) {
      taskId = taskById.id;
    } else {
      // 按标题模糊匹配
      const [taskByTitle] = await db.select({ id: tasks.id }).from(tasks)
        .where(sql`lower(${tasks.title}) LIKE ${`%${taskRef.toLowerCase()}%`}`)
        .limit(1);
      if (taskByTitle) {
        taskId = taskByTitle.id;
      }
      // 找不到就保持 null，不设置无效的 FK
    }
  }

  // 检查是否已存在该文档的交付记录
  const [existingDelivery] = await db.select().from(deliveries)
    .where(eq(deliveries.documentId, documentId));

  const now = new Date();
  const title = frontmatter.title || doc.title;
  const version = frontmatter.delivery_version || 1;
  const platform = (frontmatter.delivery_platform || 'local') as 'local' | 'tencent-doc' | 'feishu' | 'notion' | 'other';

  if (existingDelivery) {
    // 更新现有交付记录
    const updateData: Record<string, unknown> = {
      title,
      status: frontmatter.delivery_status,
      version,
      platform,
      updatedAt: now,
    };
    if (reviewerId) updateData.reviewerId = reviewerId;
    if (frontmatter.delivery_comment) updateData.reviewComment = frontmatter.delivery_comment;
    if (taskId) updateData.taskId = taskId;

    await db.update(deliveries).set(updateData).where(eq(deliveries.id, existingDelivery.id));
    eventBus.emit({ type: 'delivery_update', resourceId: existingDelivery.id });
  } else {
    // 创建新交付记录
    const newId = generateDeliveryId();
    await db.insert(deliveries).values({
      id: newId,
      memberId,
      taskId,
      documentId,
      title,
      description: `由文档 ${title} 自动创建`,
      platform,
      externalUrl: null,
      status: frontmatter.delivery_status,
      reviewerId,
      reviewComment: frontmatter.delivery_comment || null,
      version,
      previousDeliveryId: null,
      source: 'local',
      createdAt: now,
      updatedAt: now,
    } as any);
    eventBus.emit({ type: 'delivery_update', resourceId: newId });
  }
}
