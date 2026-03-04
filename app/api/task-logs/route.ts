import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { taskLogs, tasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateLogId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';

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
    return NextResponse.json({ error: '获取任务日志失败', detail }, { status: 500 });
  }
}

// POST /api/task-logs - 创建任务日志
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, action, message } = body;

    if (!taskId || !action || !message) {
      return NextResponse.json({ error: 'taskId, action 和 message 为必填' }, { status: 400 });
    }

    // 外键校验：检查任务是否存在
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return NextResponse.json({ error: '关联的任务不存在' }, { status: 404 });
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
    return NextResponse.json(newLog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '创建任务日志失败' }, { status: 500 });
  }
}
