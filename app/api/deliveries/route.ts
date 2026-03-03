import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveries } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { generateDeliveryId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_DELIVERY_STATUS, VALID_DELIVERY_PLATFORM } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';

// GET - 获取所有交付记录（支持分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const status = searchParams.get('status');
    const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
    const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
    const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
    const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

    const conditions = [];
    if (memberId) {
      conditions.push(eq(deliveries.memberId, memberId));
    }
    if (status) {
      const validStatus = validateEnum(status, VALID_DELIVERY_STATUS);
      if (!validStatus) {
        return NextResponse.json({ error: `status 必须是 ${VALID_DELIVERY_STATUS.join('/')} 之一` }, { status: 400 });
      }
      conditions.push(eq(deliveries.status, validStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const result = await db.select().from(deliveries)
        .where(whereClause)
        .orderBy(desc(deliveries.createdAt))
        .limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(deliveries).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    const allDeliveries = await db
      .select()
      .from(deliveries)
      .where(whereClause)
      .orderBy(desc(deliveries.createdAt));

    return NextResponse.json(allDeliveries);
  } catch (error) {
    console.error('[API] deliveries GET error:', error);
    const detail = process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: '获取交付记录失败', detail }, { status: 500 });
  }
}

// POST - 创建交付记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.memberId || !body.title || !body.platform) {
      return NextResponse.json({ error: '缺少必填字段: memberId, title, platform' }, { status: 400 });
    }

    if (!validateEnum(body.platform, VALID_DELIVERY_PLATFORM)) {
      return NextResponse.json({ error: `platform 必须是 ${VALID_DELIVERY_PLATFORM.join('/')} 之一` }, { status: 400 });
    }

    if (body.platform === 'local' && !body.documentId) {
      return NextResponse.json({ error: '本地文档交付需要关联 documentId' }, { status: 400 });
    }
    if (body.platform !== 'local' && !body.externalUrl) {
      return NextResponse.json({ error: '外部文档交付需要提供 externalUrl' }, { status: 400 });
    }

    if (body.status !== undefined && !validateEnum(body.status, VALID_DELIVERY_STATUS)) {
      return NextResponse.json({ error: `status 必须是 ${VALID_DELIVERY_STATUS.join('/')} 之一` }, { status: 400 });
    }

    const now = new Date();
    const allowedFields = [
      'memberId', 'taskId', 'documentId', 'title', 'description', 'platform',
      'externalUrl', 'externalId', 'status', 'reviewerId',
      'reviewedAt', 'reviewComment', 'version', 'previousDeliveryId'
    ];
    const values: Record<string, unknown> = { id: generateDeliveryId(), createdAt: now, updatedAt: now };
    for (const field of allowedFields) {
      if (body[field] !== undefined) values[field] = body[field];
    }

    const [delivery] = await db
      .insert(deliveries)
      .values(values as any)
      .returning();

    eventBus.emit({ type: 'delivery_update', resourceId: delivery.id });
    triggerMarkdownSync('comind:deliveries');
    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '创建交付记录失败' }, { status: 500 });
  }
}
