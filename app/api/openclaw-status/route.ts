import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateStatusId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_OPENCLAW_STATUS } from '@/lib/validators';

// GET - 获取所有 OpenClaw 状态
export async function GET() {
  try {
    const status = await db.select().from(openclawStatus);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 });
  }
}

// POST - 创建或更新状态
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, ...data } = body;

    if (!memberId) {
      return NextResponse.json({ error: '缺少必填字段: memberId' }, { status: 400 });
    }

    if (data.status !== undefined) {
      if (!validateEnum(data.status, VALID_OPENCLAW_STATUS)) {
        return NextResponse.json({ error: `status 必须是 ${VALID_OPENCLAW_STATUS.join('/')} 之一` }, { status: 400 });
      }
    }

    const allowedFields = [
      'status', 'currentTaskId', 'currentTaskTitle', 'currentAction',
      'progress', 'startedAt', 'estimatedEndAt', 'nextTaskId',
      'nextTaskTitle', 'queuedTasks', 'interruptible', 'doNotDisturbReason', 'lastHeartbeat'
    ];
    const safeData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) safeData[field] = data[field];
    }

    const dateFields = ['startedAt', 'estimatedEndAt', 'lastHeartbeat'];
    for (const field of dateFields) {
      if (safeData[field] && typeof safeData[field] === 'string') {
        safeData[field] = new Date(safeData[field] as string);
      }
    }

    const existing = await db
      .select()
      .from(openclawStatus)
      .where(eq(openclawStatus.memberId, memberId))
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      const [updated] = await db
        .update(openclawStatus)
        .set({
          ...safeData,
          updatedAt: now,
        })
        .where(eq(openclawStatus.memberId, memberId))
        .returning();
      eventBus.emit({ type: 'openclaw_status', resourceId: memberId });
      return NextResponse.json(updated);
    } else {
      const [created] = await db
        .insert(openclawStatus)
        .values({
          id: generateStatusId(),
          memberId,
          ...safeData,
          createdAt: now,
          updatedAt: now,
        } as any)
        .returning();
      eventBus.emit({ type: 'openclaw_status', resourceId: memberId });
      return NextResponse.json(created);
    }
  } catch (error) {
    return NextResponse.json({ error: '创建/更新状态失败' }, { status: 500 });
  }
}
