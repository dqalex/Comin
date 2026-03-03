/**
 * MCP Handler: 文档交付操作
 */

import { db } from '@/db';
import { deliveries, tasks, members, documents } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateDeliveryId } from '@/lib/id';
import { resolveAIMemberId, resolveHumanMemberId } from '@/core/member-resolver';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { getServerGatewayClient } from '@/lib/server-gateway-client';

/** 获取 CoMind 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建交付记录访问链接 */
function buildDeliveryUrl(deliveryId: string): string {
  return `${getBaseUrl()}/deliveries?delivery=${deliveryId}`;
}

export async function handleDeliverDocument(params: Record<string, unknown>) {
  const { title, description, platform, external_url, task_id, document_id } = params as {
    title: string;
    description?: string;
    platform: 'tencent-doc' | 'feishu' | 'notion' | 'local' | 'other';
    external_url?: string;
    task_id?: string;
    document_id?: string;
  };
  
  const member_id = params.member_id as string | undefined;
  const resolved = await resolveAIMemberId(member_id);
  if ('error' in resolved) return { success: false, error: resolved.error };
  const targetMemberId = resolved.memberId;

  if (platform === 'local' && !document_id) {
    return { success: false, error: '本地文档交付需要提供 document_id' };
  }
  if (platform !== 'local' && !external_url) {
    return { success: false, error: '外部文档交付需要提供 external_url' };
  }
  
  const now = new Date();
  const id = generateDeliveryId();
  await db.insert(deliveries).values({
    id,
    memberId: targetMemberId,
    taskId: task_id || null,
    documentId: document_id || null,
    title,
    description: description || null,
    platform,
    externalUrl: external_url || null,
    status: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  } as any);
  
  eventBus.emit({ type: 'delivery_update', resourceId: id });
  triggerMarkdownSync('comind:deliveries');
  return { 
    success: true, 
    data: { 
      id, 
      title, 
      url: buildDeliveryUrl(id),
      message: `文档「${title}」已提交交付` 
    } 
  };
}

export async function handleReviewDelivery(params: Record<string, unknown>) {
  const { delivery_id, status, comment } = params as {
    delivery_id: string;
    status: 'approved' | 'rejected' | 'revision_needed';
    comment?: string;
  };
  
  const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, delivery_id));
  if (!delivery) return { success: false, error: '交付记录不存在' };
  
  const member_id = params.member_id as string | undefined;
  const resolvedReviewer = await resolveHumanMemberId(member_id);
  // 问题 #30：检查返回值是否有 error
  if ('error' in resolvedReviewer) {
    return { success: false, error: resolvedReviewer.error as string };
  }
  const reviewerId = resolvedReviewer.memberId;
  
  await db.update(deliveries).set({
    status,
    reviewerId: reviewerId || null,
    reviewComment: comment || null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(deliveries.id, delivery_id));
  
  eventBus.emit({ type: 'delivery_update', resourceId: delivery_id });
  triggerMarkdownSync('comind:deliveries');

  // 同步更新文档 Front Matter 中的交付字段
  if (delivery.documentId) {
    await updateDocumentDeliveryFrontmatter(delivery.documentId, status, reviewerId || undefined, comment);
  }

  // 同步关联任务状态 + 信道通知 agent
  if (delivery.taskId) {
    await syncTaskStatusFromReview(delivery.taskId, status, delivery.title, delivery.memberId, comment);
  }

  const statusLabel = status === 'approved' ? '通过' : status === 'rejected' ? '拒绝' : '需修改';
  return { success: true, data: { delivery_id, status, message: `文档交付已${statusLabel}` } };
}

/**
 * 更新文档 Front Matter 中的交付字段
 */
async function updateDocumentDeliveryFrontmatter(
  documentId: string,
  status: 'approved' | 'rejected' | 'revision_needed',
  reviewerId?: string,
  comment?: string,
) {
  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    if (!doc || !doc.content) return;

    // 获取审核人名称
    let reviewerName = '';
    if (reviewerId) {
      const [reviewer] = await db.select().from(members).where(eq(members.id, reviewerId));
      reviewerName = reviewer?.name || '';
    }

    // 更新 Front Matter
    const updatedContent = updateFrontmatterDeliveryFields(
      doc.content,
      {
        delivery_status: status,
        delivery_reviewer: reviewerName,
        delivery_comment: comment || '',
      }
    );

    if (updatedContent !== doc.content) {
      await db.update(documents).set({
        content: updatedContent,
        updatedAt: new Date(),
      }).where(eq(documents.id, documentId));
      eventBus.emit({ type: 'document_update', resourceId: documentId });
    }
  } catch (err) {
    console.error('[delivery.handler] updateDocumentDeliveryFrontmatter error:', err);
  }
}

/**
 * 更新文档 Front Matter 中的交付字段
 */
function updateFrontmatterDeliveryFields(
  content: string,
  fields: {
    delivery_status: string;
    delivery_reviewer: string;
    delivery_comment: string;
  }
): string {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return content;

  let frontmatter = frontmatterMatch[1];
  const lines = frontmatter.split('\n');
  const updatedLines: string[] = [];
  const updatedKeys = new Set<string>();

  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1];
      if (key === 'delivery_status') {
        updatedLines.push(`delivery_status: ${fields.delivery_status}`);
        updatedKeys.add('delivery_status');
      } else if (key === 'delivery_reviewer') {
        updatedLines.push(`delivery_reviewer: ${fields.delivery_reviewer}`);
        updatedKeys.add('delivery_reviewer');
      } else if (key === 'delivery_comment') {
        updatedLines.push(`delivery_comment: ${fields.delivery_comment}`);
        updatedKeys.add('delivery_comment');
      } else if (key === 'updated') {
        updatedLines.push(`updated: ${new Date().toISOString()}`);
      } else {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  // 添加缺失的字段
  if (!updatedKeys.has('delivery_status')) {
    updatedLines.push(`delivery_status: ${fields.delivery_status}`);
  }
  if (!updatedKeys.has('delivery_reviewer') && fields.delivery_reviewer) {
    updatedLines.push(`delivery_reviewer: ${fields.delivery_reviewer}`);
  }
  if (!updatedKeys.has('delivery_comment') && fields.delivery_comment) {
    updatedLines.push(`delivery_comment: ${fields.delivery_comment}`);
  }

  const newFrontmatter = updatedLines.join('\n');
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${newFrontmatter}\n---`);
}

/**
 * 审核状态 → 任务状态映射 + 信道通知
 */
async function syncTaskStatusFromReview(
  taskId: string,
  reviewStatus: string,
  deliveryTitle: string,
  memberId: string,
  reviewComment?: string,
) {
  try {
    type TaskStatus = 'todo' | 'in_progress' | 'reviewing' | 'completed';
    const taskStatusMap: Record<string, TaskStatus> = {
      approved: 'completed',
      revision_needed: 'in_progress',
      rejected: 'in_progress',
    };
    const newTaskStatus = taskStatusMap[reviewStatus];
    if (!newTaskStatus) return;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return;

    await db.update(tasks).set({
      status: newTaskStatus,
      updatedAt: new Date(),
    }).where(eq(tasks.id, taskId));

    eventBus.emit({ type: 'task_update', resourceId: taskId });
    triggerMarkdownSync('comind:tasks');

    // 需要修改 / 退回 时，通过信道通知 agent
    if (reviewStatus === 'revision_needed' || reviewStatus === 'rejected') {
      await notifyAgentViaChat(memberId, deliveryTitle, reviewStatus, reviewComment);
    }
  } catch (err) {
    console.error('[delivery.handler] syncTaskStatusFromReview error:', err);
  }
}

/**
 * 通过 Gateway 信道通知 agent 审核结果
 */
async function notifyAgentViaChat(
  memberId: string,
  deliveryTitle: string,
  reviewStatus: string,
  reviewComment?: string,
) {
  try {
    const client = getServerGatewayClient();
    if (!client.isConnected) return;

    const [member] = await db.select().from(members).where(
      and(eq(members.id, memberId), eq(members.type, 'ai'))
    );
    if (!member) return;

    const agentId = member.openclawAgentId || member.openclawName;
    if (!agentId) return;

    // 通过 Gateway agents.list 获取准确的 mainKey 作为 sessionKey
    // 避免硬拼 `agent:${agentId}` 导致 sessionKey 不匹配
    let sessionKey = `agent:${agentId}`;
    try {
      const agentsResult = await client.request('agents.list', {}) as { mainKey?: string };
      if (agentsResult?.mainKey) {
        sessionKey = agentsResult.mainKey;
      }
    } catch {
      // fallback 到拼接的 sessionKey
    }
    const statusLabel = reviewStatus === 'revision_needed' ? '需要修改' : '退回';
    const commentPart = reviewComment ? `\n审核意见: ${reviewComment}` : '';

    const message = `[CoMind 审核通知] 你提交的文档「${deliveryTitle}」审核结果: ${statusLabel}。${commentPart}\n请根据审核意见修改后重新提交。`;

    await client.request('chat.send', {
      sessionKey,
      message,
      idempotencyKey: `review-notify-${memberId}-${Date.now()}`,
    });
  } catch (err) {
    console.error('[delivery.handler] notifyAgentViaChat error:', err);
  }
}

/**
 * 获取当前 AI 成员的交付物列表
 */
export async function handleListMyDeliveries(params: Record<string, unknown>) {
  const { status = 'all', limit = 20 } = params as {
    status?: 'pending' | 'approved' | 'rejected' | 'revision_needed' | 'all';
    limit?: number;
  };

  const member_id = params.member_id as string | undefined;
  const resolved = await resolveAIMemberId(member_id);
  if ('error' in resolved) return { success: false, error: resolved.error };
  const targetMemberId = resolved.memberId;

  try {
    const whereCondition = status === 'all'
      ? eq(deliveries.memberId, targetMemberId)
      : and(eq(deliveries.memberId, targetMemberId), eq(deliveries.status, status));

    const results = await db.select().from(deliveries)
      .where(whereCondition)
      .orderBy(desc(deliveries.updatedAt))
      .limit(limit);

    const deliveryList = results.map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
      platform: d.platform,
      document_id: d.documentId,
      task_id: d.taskId,
      created_at: d.createdAt?.toISOString(),
      updated_at: d.updatedAt?.toISOString(),
    }));

    return {
      success: true,
      data: {
        total: deliveryList.length,
        deliveries: deliveryList,
      },
    };
  } catch (err) {
    console.error('[delivery.handler] handleListMyDeliveries error:', err);
    return { success: false, error: '查询交付物列表失败' };
  }
}

/**
 * 获取交付物详情
 */
export async function handleGetDelivery(params: Record<string, unknown>) {
  const { delivery_id } = params as { delivery_id: string };

  try {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, delivery_id));
    if (!delivery) {
      return { success: false, error: '交付记录不存在' };
    }

    // 获取关联文档信息
    let documentInfo = null;
    if (delivery.documentId) {
      const [doc] = await db.select().from(documents).where(eq(documents.id, delivery.documentId));
      if (doc) {
        documentInfo = {
          id: doc.id,
          title: doc.title,
          type: doc.type,
        };
      }
    }

    // 获取关联任务信息
    let taskInfo = null;
    if (delivery.taskId) {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, delivery.taskId));
      if (task) {
        taskInfo = {
          id: task.id,
          title: task.title,
          status: task.status,
        };
      }
    }

    // 获取审核人信息
    let reviewerInfo = null;
    if (delivery.reviewerId) {
      const [reviewer] = await db.select().from(members).where(eq(members.id, delivery.reviewerId));
      if (reviewer) {
        reviewerInfo = {
          id: reviewer.id,
          name: reviewer.name,
        };
      }
    }

    return {
      success: true,
      data: {
        id: delivery.id,
        title: delivery.title,
        description: delivery.description,
        status: delivery.status,
        platform: delivery.platform,
        external_url: delivery.externalUrl,
        version: delivery.version,
        review_comment: delivery.reviewComment,
        reviewed_at: delivery.reviewedAt?.toISOString(),
        created_at: delivery.createdAt?.toISOString(),
        updated_at: delivery.updatedAt?.toISOString(),
        document: documentInfo,
        task: taskInfo,
        reviewer: reviewerInfo,
      },
    };
  } catch (err) {
    console.error('[delivery.handler] handleGetDelivery error:', err);
    return { success: false, error: '获取交付物详情失败' };
  }
}
