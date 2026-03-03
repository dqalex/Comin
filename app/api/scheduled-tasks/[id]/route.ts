import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTasks, scheduledTaskHistory } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_TASK_TYPE, VALID_SCHEDULE_TYPE, VALID_LAST_RUN_STATUS } from '@/lib/validators';

// GET - 获取单个定时任务
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [task] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, id));

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const history = await db
      .select()
      .from(scheduledTaskHistory)
      .where(eq(scheduledTaskHistory.scheduledTaskId, id))
      .orderBy(desc(scheduledTaskHistory.startedAt))
      .limit(30);

    return NextResponse.json({ ...task, history });
  } catch (error) {
    return NextResponse.json({ error: '获取定时任务失败' }, { status: 500 });
  }
}

// PUT - 更新定时任务
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
    if (!existing) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (body.taskType && !validateEnum(body.taskType, VALID_TASK_TYPE)) {
      return NextResponse.json({ error: `taskType 必须是 ${VALID_TASK_TYPE.join('/')} 之一` }, { status: 400 });
    }
    if (body.scheduleType && !validateEnum(body.scheduleType, VALID_SCHEDULE_TYPE)) {
      return NextResponse.json({ error: `scheduleType 必须是 ${VALID_SCHEDULE_TYPE.join('/')} 之一` }, { status: 400 });
    }
    if (body.lastRunStatus && !validateEnum(body.lastRunStatus, VALID_LAST_RUN_STATUS)) {
      return NextResponse.json({ error: `lastRunStatus 必须是 ${VALID_LAST_RUN_STATUS.join('/')} 之一` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = [
      'title', 'description', 'taskType', 'scheduleType',
      'scheduleTime', 'scheduleDays', 'nextRunAt', 'config',
      'enabled', 'lastRunAt', 'lastRunStatus', 'lastRunResult',
      'memberId'
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const dateFields = ['nextRunAt', 'lastRunAt'];
    for (const field of dateFields) {
      if (updateData[field] && typeof updateData[field] === 'string') {
        updateData[field] = new Date(updateData[field] as string);
      }
    }

    const [task] = await db
      .update(scheduledTasks)
      .set(updateData)
      .where(eq(scheduledTasks.id, id))
      .returning();

    eventBus.emit({ type: 'schedule_update', resourceId: task.id });
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: '更新定时任务失败' }, { status: 500 });
  }
}

// DELETE - 删除定时任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
    if (!existing) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      tx.delete(scheduledTaskHistory).where(eq(scheduledTaskHistory.scheduledTaskId, id)).run();
      tx.delete(scheduledTasks).where(eq(scheduledTasks.id, id)).run();
    });

    eventBus.emit({ type: 'schedule_update', resourceId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/scheduled-tasks]', error);
    return NextResponse.json({ error: '删除定时任务失败' }, { status: 500 });
  }
}
