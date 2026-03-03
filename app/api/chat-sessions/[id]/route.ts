import { NextRequest, NextResponse } from 'next/server';
import { db, chatSessions, chatMessages } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

// GET /api/chat-sessions/[id] - 获取单个会话（含所有消息）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    if (session.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(asc(chatMessages.createdAt));

    return NextResponse.json({ ...session[0], messages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// PUT /api/chat-sessions/[id] - 更新会话
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = ['title', 'conversationId'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    await db.update(chatSessions).set(updateData).where(eq(chatSessions.id, id));
    const [updated] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: id });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

// DELETE /api/chat-sessions/[id] - 删除会话（级联删除消息）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 同步事务（better-sqlite3 不支持 async 回调）
    db.transaction((tx) => {
      tx.delete(chatMessages).where(eq(chatMessages.sessionId, id)).run();
      tx.delete(chatSessions).where(eq(chatSessions.id, id)).run();
    });

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/chat-sessions]', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
