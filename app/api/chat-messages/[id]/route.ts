import { NextRequest, NextResponse } from 'next/server';
import { db, chatMessages } from '@/db';
import { eq } from 'drizzle-orm';
import { validateEnum, VALID_MESSAGE_STATUS } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';

// PUT /api/chat-messages/[id] - 更新消息（状态等）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['status', 'content'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'status') {
          const validStatus = validateEnum(body.status, VALID_MESSAGE_STATUS);
          if (!validStatus) {
            return NextResponse.json({ error: `status 必须是 ${VALID_MESSAGE_STATUS.join('/')} 之一` }, { status: 400 });
          }
          updateData.status = validStatus;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    await db.update(chatMessages).set(updateData).where(eq(chatMessages.id, id));
    const [updated] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: existing.sessionId });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
