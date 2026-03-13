import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { taskLogs, tasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateLogId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';

// GET /api/task-logs - 获取任务日志（按任务ID过滤）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  try {
    let result;
    if (taskId) {
      result = await db.select().from(taskLogs)
        .where(eq(taskLogs.taskId, taskId))
        .orderBy(desc(taskLogs.timestamp))
        .limit(500);
    } else {
      result = await db.select().from(taskLogs)
        .orderBy(desc(taskLogs.timestamp))
        .limit(500);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] task-logs GET error:', error);
    const detail = process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: 'Failed to fetch task logs', detail }, { status: 500 });
  }
}

// POST /api/task-logs - 创建任务日志
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();
    const { taskId, action, message } = body;

    if (!taskId || !action || !message) {
      return errorResponse(ApiErrors.badRequest('taskId, action and message are required'), requestId);
    }

    // 外键校验：检查任务是否存在
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return errorResponse(ApiErrors.notFound('Related task'), requestId);
    }

    const newLog = {
      id: generateLogId(),
      taskId,
      action,
      message,
      timestamp: new Date(),
    };

    await db.insert(taskLogs).values(newLog);
    // 问题 #21：创建日志后通知前端刷新任务
    eventBus.emit({ type: 'task_update', resourceId: taskId });
    return createdResponse(newLog);
  } catch (error) {
    console.error(`[POST /api/task-logs] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create task log'), requestId);
  }
}
