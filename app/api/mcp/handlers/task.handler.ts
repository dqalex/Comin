/**
 * MCP Handler: 任务操作
 */

import { db } from '@/db';
import { tasks, comments, taskLogs, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateLogId, generateCommentId, generateCheckItemId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';

/** 获取 CoMind 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建任务访问链接 */
function buildTaskUrl(taskId: string): string {
  return `${getBaseUrl()}/tasks?task=${taskId}`;
}

export async function handleGetTask(params: Record<string, unknown>) {
  const { task_id } = params as { task_id: string };
  const [task] = await db.select().from(tasks).where(eq(tasks.id, task_id));
  if (!task) {
    return { success: false, error: '任务不存在' };
  }
  return { 
    success: true, 
    data: {
      ...task,
      url: buildTaskUrl(task.id),
    }
  };
}

export async function handleUpdateTaskStatus(params: Record<string, unknown>) {
  const { task_id, status, progress, message } = params as {
    task_id: string;
    status: 'todo' | 'in_progress' | 'reviewing' | 'completed';
    progress?: number;
    message?: string;
  };
  
  const [task] = await db.select().from(tasks).where(eq(tasks.id, task_id));
  if (!task) {
    return { success: false, error: '任务不存在' };
  }
  
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (progress !== undefined) {
    updateData.progress = progress;
  }
  await db.update(tasks).set(updateData).where(eq(tasks.id, task_id));
  
  if (message) {
    await db.insert(taskLogs).values({
      id: generateLogId(),
      taskId: task_id,
      action: `status_change:${status}`,
      message,
      timestamp: new Date(),
    });
  }
  
  eventBus.emit({ type: 'task_update', resourceId: task_id });
  triggerMarkdownSync('comind:tasks');
  return { 
    success: true, 
    data: { task_id, status, progress, message: message || '状态已更新' } 
  };
}

export async function handleAddTaskComment(params: Record<string, unknown>) {
  const { task_id, content, member_id } = params as { task_id: string; content: string; member_id?: string };
  const [task] = await db.select().from(tasks).where(eq(tasks.id, task_id));
  if (!task) {
    return { success: false, error: '任务不存在' };
  }
  
  // 优先使用调用方提供的 member_id，否则回退到 'ai-agent'
  const authorId = member_id || 'ai-agent';
  const comment = {
    id: generateCommentId(),
    taskId: task_id,
    authorId,
    content,
    createdAt: new Date(),
  };
  await db.insert(comments).values(comment);
  
  eventBus.emit({ type: 'task_update', resourceId: task_id });
  return { 
    success: true, 
    data: { comment, message: '评论已添加' } 
  };
}

export async function handleCreateCheckItem(params: Record<string, unknown>) {
  const { task_id, text } = params as { task_id: string; text: string };
  const [task] = await db.select().from(tasks).where(eq(tasks.id, task_id));
  if (!task) {
    return { success: false, error: '任务不存在' };
  }
  
  const newItem = { id: generateCheckItemId(), text, completed: false };
  const checkItems = task.checkItems || [];
  await db.update(tasks).set({ 
    checkItems: [...checkItems, newItem], 
    updatedAt: new Date() 
  }).where(eq(tasks.id, task_id));
  
  eventBus.emit({ type: 'task_update', resourceId: task_id });
  triggerMarkdownSync('comind:tasks');
  return { 
    success: true, 
    data: { item: newItem, message: '检查项已创建' } 
  };
}

export async function handleCompleteCheckItem(params: Record<string, unknown>) {
  const { task_id, item_id } = params as { task_id: string; item_id: string };
  const [task] = await db.select().from(tasks).where(eq(tasks.id, task_id));
  if (!task) {
    return { success: false, error: '任务不存在' };
  }
  
  const checkItems = task.checkItems || [];
  const updatedItems = checkItems.map(item =>
    item.id === item_id ? { ...item, completed: true } : item
  );
  await db.update(tasks).set({ 
    checkItems: updatedItems, 
    updatedAt: new Date() 
  }).where(eq(tasks.id, task_id));
  
  eventBus.emit({ type: 'task_update', resourceId: task_id });
  triggerMarkdownSync('comind:tasks');
  return { 
    success: true, 
    data: { item_id, message: '检查项已完成' } 
  };
}

/** 获取分配给当前成员的任务列表 */
export async function handleListMyTasks(params: Record<string, unknown>) {
  const { member_id, member_name, status, project_id, limit = 20 } = params as {
    member_id?: string;
    member_name?: string;
    status?: 'todo' | 'in_progress' | 'reviewing' | 'completed' | 'all';
    project_id?: string;
    limit?: number;
  };

  // 解析成员身份：优先 member_id，其次 member_name（按昵称查找）
  let resolvedMemberId = member_id;
  if (!resolvedMemberId && member_name) {
    const allMembers = await db.select({ id: members.id, name: members.name })
      .from(members);
    const matched = allMembers.find(m => m.name === member_name);
    if (matched) {
      resolvedMemberId = matched.id;
    } else {
      return {
        success: false,
        error: `未找到名为 "${member_name}" 的成员`,
      };
    }
  }

  // 获取所有任务后在内存中过滤（因为 assignees 是 JSON 数组）
  const allTasks = await db.select().from(tasks);
  
  let filteredTasks = allTasks;
  
  // 按成员过滤（如果提供了 member_id 或 member_name 解析结果）
  if (resolvedMemberId) {
    filteredTasks = filteredTasks.filter(t => {
      const assignees = t.assignees || [];
      return assignees.includes(resolvedMemberId!);
    });
  }
  
  // 按状态过滤
  if (status && status !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.status === status);
  }
  
  // 按项目过滤
  if (project_id) {
    filteredTasks = filteredTasks.filter(t => t.projectId === project_id);
  }
  
  // 排序：优先级高的在前，同优先级按创建时间排序
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filteredTasks.sort((a, b) => {
    const pa = priorityOrder[a.priority || 'medium'] ?? 1;
    const pb = priorityOrder[b.priority || 'medium'] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
  });
  
  // 限制返回数量
  const limitedTasks = filteredTasks.slice(0, limit as number);
  
  // 格式化返回数据
  const result = limitedTasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId,
    deadline: t.deadline,
    createdAt: t.createdAt,
    url: buildTaskUrl(t.id),
    description: t.description ? t.description.slice(0, 200) : undefined,
  }));
  
  return { 
    success: true, 
    data: { 
      tasks: result, 
      total: filteredTasks.length,
      returned: result.length,
      message: `找到 ${filteredTasks.length} 个任务，返回前 ${result.length} 个` 
    } 
  };
}
