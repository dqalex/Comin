import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chatSessions, chatMessages, tasks, deliveries, comments, taskLogs, openclawStatus } from '@/db/schema';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';
import { eq, inArray } from 'drizzle-orm';
import { normalizeId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_TASK_STATUS, VALID_PRIORITY } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { checkProjectAccess } from '@/lib/project-access';
import { isValidId } from '@/lib/security';
import { apiSuccess, notFound, forbidden, badRequest, serverError } from '@/lib/api-utils';

/**
 * 兼容查找：先用 normalizedId 查，未找到且 normalizedId !== id 时用原始 id 回退
 */
async function findTask(id: string) {
  const normalizedId = normalizeId(id);
  let [found] = await db.select().from(tasks).where(eq(tasks.id, normalizedId));
  if (!found && normalizedId !== id) {
    [found] = await db.select().from(tasks).where(eq(tasks.id, id));
  }
  return found ?? null;
}

// GET /api/tasks/[id] - 获取单个任务
// v3.0: 需要登录才能访问，任务权限继承项目权限
export const GET = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const { id } = await context!.params;
    const task = await findTask(id);
    if (!task) {
      return notFound('Task');
    }
    
    // v3.0: 检查项目权限（无项目的任务所有登录用户可见）
    if (task.projectId && auth.userRole !== 'admin') {
      const access = await checkProjectAccess(task.projectId, auth.userId!, auth.userRole!);
      if (!access.hasAccess) {
        return forbidden('No permission to access this task');
      }
    }
    
    return apiSuccess(task);
  } catch (error) {
    return serverError('Failed to fetch task');
  }
});

// PUT /api/tasks/[id] - 更新任务
// v3.0: 需要登录才能修改，任务权限继承项目权限（需要编辑权限）
export const PUT = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();

    const existing = await findTask(id);
    if (!existing) {
      return notFound('Task');
    }
    const resolvedId = existing.id;

    // v3.0: 检查项目权限（无项目的任务所有登录用户可编辑）
    if (existing.projectId && auth.userRole !== 'admin') {
      const access = await checkProjectAccess(existing.projectId, auth.userId!, auth.userRole!);
      if (!access.canEdit) {
        return forbidden('No permission to modify this task');
      }
    }
    
    // v3.0: 如果要修改 projectId，检查目标项目的编辑权限
    if (body.projectId !== undefined && body.projectId !== existing.projectId) {
      if (body.projectId && !isValidId(body.projectId)) {
        return badRequest('Invalid projectId format');
      }
      
      if (body.projectId) {
        const targetAccess = await checkProjectAccess(body.projectId, auth.userId!, auth.userRole!);
        if (!targetAccess.canEdit) {
          return forbidden('No permission to move task to this project');
        }
      }
    }

    if (body.status && !validateEnum(body.status, VALID_TASK_STATUS)) {
      return badRequest(`status must be one of: ${VALID_TASK_STATUS.join('/')}`);
    }
    if (body.priority && !validateEnum(body.priority, VALID_PRIORITY)) {
      return badRequest(`priority must be one of: ${VALID_PRIORITY.join('/')}`);
    }
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    const allowedFields = [
      'title', 'description', 'projectId', 'milestoneId', 'assignees', 'status', 'progress',
      'priority', 'deadline', 'checkItems', 'attachments', 'parentTaskId',
      'crossProjects',
      // SOP 字段
      'sopTemplateId', 'currentStageId', 'stageHistory', 'sopInputs'
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // progress 范围校验：0-100
        if (field === 'progress' && typeof body[field] === 'number') {
          updateData[field] = Math.min(100, Math.max(0, body[field]));
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (updateData.deadline && typeof updateData.deadline === 'string') {
      updateData.deadline = new Date(updateData.deadline);
    }

    await db.update(tasks).set(updateData).where(eq(tasks.id, resolvedId));
    
    const [updated] = await db.select().from(tasks).where(eq(tasks.id, resolvedId));
    eventBus.emit({ type: 'task_update', resourceId: resolvedId });
    triggerMarkdownSync('teamclaw:tasks');
    return apiSuccess(updated);
  } catch (error) {
    return serverError('Failed to update task');
  }
});

// DELETE /api/tasks/[id] - 删除任务（级联清理）
// v3.0: 需要登录才能删除，任务权限继承项目权限（需要编辑权限）
export const DELETE = withAuth(async (
  request: NextRequest,
  auth: AuthResult,
  context
) => {
  try {
    const { id } = await context!.params;
    const existing = await findTask(id);
    if (!existing) {
      return notFound('Task');
    }
    const resolvedId = existing.id;

    // v3.0: 检查项目权限（无项目的任务所有登录用户可删除）
    if (existing.projectId && auth.userRole !== 'admin') {
      const access = await checkProjectAccess(existing.projectId, auth.userId!, auth.userRole!);
      if (!access.canEdit) {
        return forbidden('No permission to delete this task');
      }
    }

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      tx.delete(taskLogs).where(eq(taskLogs.taskId, resolvedId)).run();
      tx.delete(comments).where(eq(comments.taskId, resolvedId)).run();
      tx.delete(deliveries).where(eq(deliveries.taskId, resolvedId)).run();
      tx.update(openclawStatus)
        .set({ currentTaskId: null, currentTaskTitle: null, currentAction: null, progress: 0, updatedAt: new Date() })
        .where(eq(openclawStatus.currentTaskId, resolvedId)).run();
      tx.update(openclawStatus)
        .set({ nextTaskId: null, nextTaskTitle: null, updatedAt: new Date() })
        .where(eq(openclawStatus.nextTaskId, resolvedId)).run();
      // 清理 queuedTasks JSON 字段中的任务引用
      const allStatus = tx.select({ id: openclawStatus.id, queuedTasks: openclawStatus.queuedTasks }).from(openclawStatus).all();
      for (const s of allStatus) {
        const queued = Array.isArray(s.queuedTasks) ? s.queuedTasks : [];
        if (queued.some((qt: { id: string }) => qt.id === resolvedId)) {
          const filtered = queued.filter((qt: { id: string }) => qt.id !== resolvedId);
          tx.update(openclawStatus).set({ queuedTasks: filtered, updatedAt: new Date() }).where(eq(openclawStatus.id, s.id)).run();
        }
      }
      // 清理子任务的 parentTaskId 引用
      tx.update(tasks)
        .set({ parentTaskId: null, updatedAt: new Date() })
        .where(eq(tasks.parentTaskId, resolvedId)).run();
      // 问题 #25：清理关联的 chatSessions
      const taskSessions = tx
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(eq(chatSessions.entityId, resolvedId))
        .all();
      const sessionIds = taskSessions.map(s => s.id);
      if (sessionIds.length > 0) {
        tx.delete(chatMessages).where(inArray(chatMessages.sessionId, sessionIds)).run();
        tx.delete(chatSessions).where(inArray(chatSessions.id, sessionIds)).run();
      }
      tx.delete(tasks).where(eq(tasks.id, resolvedId)).run();
    });
    
    eventBus.emit({ type: 'task_update', resourceId: resolvedId });
    triggerMarkdownSync('teamclaw:tasks');
    return apiSuccess({ success: true });
  } catch (error) {
    console.error('[DELETE /api/tasks]', error);
    return serverError('Failed to delete task');
  }
});
