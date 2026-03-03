import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTasks, scheduledTaskHistory } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { generateScheduleId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_TASK_TYPE, VALID_SCHEDULE_TYPE } from '@/lib/validators';

// GET - 获取所有定时任务
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    let tasks;
    if (memberId) {
      tasks = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.memberId, memberId));
    } else {
      tasks = await db.select().from(scheduledTasks);
    }

    if (includeHistory && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const allHistory = await db
        .select()
        .from(scheduledTaskHistory)
        .where(inArray(scheduledTaskHistory.scheduledTaskId, taskIds))
        .orderBy(desc(scheduledTaskHistory.startedAt));

      const historyByTask: Record<string, typeof allHistory> = {};
      for (const h of allHistory) {
        if (!historyByTask[h.scheduledTaskId]) historyByTask[h.scheduledTaskId] = [];
        if (historyByTask[h.scheduledTaskId].length < 10) {
          historyByTask[h.scheduledTaskId].push(h);
        }
      }

      const tasksWithHistory = tasks.map(task => ({
        ...task,
        history: historyByTask[task.id] || [],
      }));
      return NextResponse.json(tasksWithHistory);
    }

    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: '获取定时任务失败' }, { status: 500 });
  }
}

// POST - 创建定时任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.memberId || !body.title || !body.taskType || !body.scheduleType) {
      return NextResponse.json({ error: '缺少必填字段: memberId, title, taskType, scheduleType' }, { status: 400 });
    }

    if (!validateEnum(body.taskType, VALID_TASK_TYPE)) {
      return NextResponse.json({ error: `taskType 必须是 ${VALID_TASK_TYPE.join('/')} 之一` }, { status: 400 });
    }
    if (!validateEnum(body.scheduleType, VALID_SCHEDULE_TYPE)) {
      return NextResponse.json({ error: `scheduleType 必须是 ${VALID_SCHEDULE_TYPE.join('/')} 之一` }, { status: 400 });
    }

    const now = new Date();
    const allowedFields = [
      'memberId', 'title', 'description', 'taskType', 'scheduleType',
      'scheduleTime', 'scheduleDays', 'nextRunAt', 'config', 'enabled'
    ];
    const values: Record<string, unknown> = { id: generateScheduleId(), createdAt: now, updatedAt: now };
    for (const field of allowedFields) {
      if (body[field] !== undefined) values[field] = body[field];
    }

    if (values.nextRunAt && typeof values.nextRunAt === 'string') {
      values.nextRunAt = new Date(values.nextRunAt);
    }

    const [task] = await db
      .insert(scheduledTasks)
      .values(values as any)
      .returning();

    eventBus.emit({ type: 'schedule_update', resourceId: task.id });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '创建定时任务失败' }, { status: 500 });
  }
}
