import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTaskHistory } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateScheduleHistoryId } from '@/lib/id';
import { validateEnum, VALID_HISTORY_STATUS, VALID_DELIVERABLE_TYPE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';

// GET /api/scheduled-task-history - 获取执行历史
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scheduledTaskId = searchParams.get('scheduledTaskId');
  const limitStr = searchParams.get('limit');
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 200) : 50;

  try {
    let result;
    if (scheduledTaskId) {
      result = await db.select().from(scheduledTaskHistory)
        .where(eq(scheduledTaskHistory.scheduledTaskId, scheduledTaskId))
        .orderBy(desc(scheduledTaskHistory.startedAt))
        .limit(limit);
    } else {
      result = await db.select().from(scheduledTaskHistory)
        .orderBy(desc(scheduledTaskHistory.startedAt))
        .limit(limit);
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: '获取执行历史失败' }, { status: 500 });
  }
}

// POST /api/scheduled-task-history - 创建执行历史记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduledTaskId, status, result, error: errorMsg, deliverableType, deliverableUrl, deliverableTitle } = body;

    if (!scheduledTaskId || !status) {
      return NextResponse.json({ error: 'scheduledTaskId 和 status 为必填' }, { status: 400 });
    }

    if (!validateEnum(status, VALID_HISTORY_STATUS)) {
      return NextResponse.json({ error: `status 必须是 ${VALID_HISTORY_STATUS.join('/')} 之一` }, { status: 400 });
    }

    const newHistory = {
      id: generateScheduleHistoryId(),
      scheduledTaskId,
      startedAt: new Date(),
      completedAt: status !== 'running' ? new Date() : null,
      status,
      result: result || null,
      error: errorMsg || null,
      deliverableType: deliverableType ? (validateEnum(deliverableType, VALID_DELIVERABLE_TYPE) || null) : null,
      deliverableUrl: deliverableUrl || null,
      deliverableTitle: deliverableTitle || null,
      createdAt: new Date(),
    };

    await db.insert(scheduledTaskHistory).values(newHistory);
    // 问题 #20：创建历史后通知前端刷新
    eventBus.emit({ type: 'schedule_update', resourceId: scheduledTaskId });
    return NextResponse.json(newHistory, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '创建执行历史失败' }, { status: 500 });
  }
}
