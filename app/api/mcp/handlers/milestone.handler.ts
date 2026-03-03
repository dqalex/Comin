/**
 * MCP Handler: 里程碑操作
 */

import { db } from '@/db';
import { milestones, tasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateMilestoneId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_MILESTONE_STATUS } from '@/lib/validators';

// 创建里程碑
export async function handleCreateMilestone(params: Record<string, unknown>) {
  const { title, description, project_id, status, due_date, sort_order } = params as {
    title: string;
    description?: string;
    project_id: string;
    status?: string;
    due_date?: string;
    sort_order?: number;
  };

  if (!title || !title.trim()) {
    return { success: false, error: '标题不能为空' };
  }
  if (!project_id) {
    return { success: false, error: '项目 ID 不能为空' };
  }

  const validStatus = validateEnum(status || 'open', VALID_MILESTONE_STATUS) || 'open';

  const now = new Date();
  const id = generateMilestoneId();
  await db.insert(milestones).values({
    id,
    title: title.trim(),
    description: description || null,
    projectId: project_id,
    status: validStatus,
    dueDate: due_date ? new Date(due_date) : null,
    sortOrder: typeof sort_order === 'number' ? sort_order : 0,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(milestones).where(eq(milestones.id, id));
  eventBus.emit({ type: 'milestone_update', resourceId: id });

  return {
    success: true,
    data: {
      id,
      title: created?.title || title,
      project_id,
      status: validStatus,
      message: `里程碑「${title}」已创建`,
    },
  };
}

// 列出里程碑
export async function handleListMilestones(params: Record<string, unknown>) {
  const { project_id } = params as { project_id?: string };

  try {
    let results;
    if (project_id) {
      results = await db.select().from(milestones)
        .where(eq(milestones.projectId, project_id))
        .orderBy(milestones.sortOrder);
    } else {
      results = await db.select().from(milestones).orderBy(milestones.sortOrder);
    }

    const milestoneList = results.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      project_id: m.projectId,
      status: m.status,
      due_date: m.dueDate?.toISOString(),
      sort_order: m.sortOrder,
      created_at: m.createdAt?.toISOString(),
    }));

    return {
      success: true,
      data: {
        total: milestoneList.length,
        milestones: milestoneList,
      },
    };
  } catch (err) {
    console.error('[milestone.handler] handleListMilestones error:', err);
    return { success: false, error: '查询里程碑列表失败' };
  }
}

// 更新里程碑
export async function handleUpdateMilestone(params: Record<string, unknown>) {
  const { milestone_id, title, description, status, due_date, sort_order } = params as {
    milestone_id: string;
    title?: string;
    description?: string;
    status?: string;
    due_date?: string;
    sort_order?: number;
  };

  if (!milestone_id) {
    return { success: false, error: '缺少 milestone_id' };
  }

  const [existing] = await db.select().from(milestones).where(eq(milestones.id, milestone_id));
  if (!existing) {
    return { success: false, error: '里程碑不存在' };
  }

  if (status && !validateEnum(status, VALID_MILESTONE_STATUS)) {
    return { success: false, error: `status 必须是 ${VALID_MILESTONE_STATUS.join('/')} 之一` };
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (due_date !== undefined) updateData.dueDate = due_date ? new Date(due_date) : null;
  if (sort_order !== undefined) updateData.sortOrder = sort_order;

  await db.update(milestones).set(updateData).where(eq(milestones.id, milestone_id));
  eventBus.emit({ type: 'milestone_update', resourceId: milestone_id });

  return {
    success: true,
    data: { milestone_id, message: '里程碑已更新' },
  };
}

// 删除里程碑
export async function handleDeleteMilestone(params: Record<string, unknown>) {
  const { milestone_id } = params as { milestone_id: string };

  if (!milestone_id) {
    return { success: false, error: '缺少 milestone_id' };
  }

  const [existing] = await db.select().from(milestones).where(eq(milestones.id, milestone_id));
  if (!existing) {
    return { success: false, error: '里程碑不存在' };
  }

  // 解除关联任务 + 删除里程碑
  db.transaction((tx) => {
    tx.update(tasks)
      .set({ milestoneId: null, updatedAt: new Date() })
      .where(eq(tasks.milestoneId, milestone_id)).run();
    tx.delete(milestones).where(eq(milestones.id, milestone_id)).run();
  });

  eventBus.emit({ type: 'milestone_update', resourceId: milestone_id });

  return {
    success: true,
    data: { milestone_id, message: `里程碑「${existing.title}」已删除` },
  };
}
