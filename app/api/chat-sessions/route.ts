import { NextRequest, NextResponse } from 'next/server';
import { db, chatSessions } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';
import { generateSessionId } from '@/lib/id';
import { validateEnum, VALID_ENTITY_TYPE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';

// GET /api/chat-sessions - 获取所有会话（支持分页）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
    const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
    const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
    const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const result = await db.select().from(chatSessions)
        .orderBy(desc(chatSessions.updatedAt))
        .limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(chatSessions);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    const sessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt));
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chat sessions' }, { status: 500 });
  }
}

// POST /api/chat-sessions - 创建新会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, memberName, title, entity } = body;

    if (!memberId || !memberName) {
      return NextResponse.json({ error: '缺少 memberId 或 memberName' }, { status: 400 });
    }

    const now = new Date();
    const id = generateSessionId();

    await db.insert(chatSessions).values({
      id,
      memberId,
      memberName,
      title: title || '新对话',
      entityType: entity?.type ? (validateEnum(entity.type, VALID_ENTITY_TYPE) || null) : null,
      entityId: entity?.id || null,
      entityTitle: entity?.title || null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db.select().from(chatSessions).where(eq(chatSessions.id, id));

    // 发送 SSE 事件通知前端刷新对话列表
    eventBus.emit({ type: 'chat_session_update', resourceId: id });

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
  }
}
