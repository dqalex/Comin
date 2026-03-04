import { NextRequest, NextResponse } from 'next/server';
import { db, chatMessages, chatSessions } from '@/db';
import { eq } from 'drizzle-orm';
import { generateMessageId } from '@/lib/id';
import { VALID_CHAT_ROLE, VALID_MESSAGE_STATUS, validateEnum, validateEnumWithDefault } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';

// POST /api/chat-messages - 添加消息到会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, role, content, status } = body;

    if (!sessionId || !role) {
      return NextResponse.json({ error: '缺少 sessionId 或 role' }, { status: 400 });
    }

    // 外键校验：检查 session 是否存在
    const [session] = await db.select({ id: chatSessions.id }).from(chatSessions).where(eq(chatSessions.id, sessionId));
    if (!session) {
      return NextResponse.json({ error: '关联的会话不存在' }, { status: 404 });
    }

    // content 允许空字符串（assistant 消息初始化时为空，后续通过 PUT 更新）
    if (content === undefined || content === null) {
      return NextResponse.json({ error: '缺少 content' }, { status: 400 });
    }

    if (!validateEnum(role, VALID_CHAT_ROLE)) {
      return NextResponse.json({ error: `role 必须是 ${VALID_CHAT_ROLE.join('/')} 之一` }, { status: 400 });
    }

    const validStatus = validateEnumWithDefault(status, VALID_MESSAGE_STATUS, 'sent');

    const now = new Date();
    const id = generateMessageId();

    await db.insert(chatMessages).values({
      id,
      sessionId,
      role,
      content,
      status: validStatus,
      createdAt: now,
    });

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (role === 'user') {
      const existingMessages = await db.select().from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId));
      if (existingMessages.length <= 1) {
        updateData.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      }
    }
    await db.update(chatSessions).set(updateData).where(eq(chatSessions.id, sessionId));

    const created = await db.select().from(chatMessages).where(eq(chatMessages.id, id));

    // 发送 SSE 事件通知前端刷新对话列表（消息添加后会话 updatedAt 会更新）
    eventBus.emit({ type: 'chat_session_update', resourceId: sessionId });

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
