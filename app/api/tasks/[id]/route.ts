import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, taskLogs, comments, deliveries, openclawStatus } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { normalizeId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_TASK_STATUS, VALID_PRIORITY } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await findTask(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PUT /api/tasks/[id] - 更新任务
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await findTask(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

    if (body.status && !validateEnum(body.status, VALID_TASK_STATUS)) {
      return NextResponse.json({ error: `status 必须是 ${VALID_TASK_STATUS.join('/')} 之一` }, { status: 400 });
    }
    if (body.priority && !validateEnum(body.priority, VALID_PRIORITY)) {
      return NextResponse.json({ error: `priority 必须是 ${VALID_PRIORITY.join('/')} 之一` }, { status: 400 });
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
    triggerMarkdownSync('comind:tasks');
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - 删除任务（级联清理）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await findTask(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const resolvedId = existing.id;

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
    triggerMarkdownSync('comind:tasks');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/tasks]', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
