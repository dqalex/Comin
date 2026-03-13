import { db } from '@/db';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { deliveries } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { generateDeliveryId, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnum, VALID_DELIVERY_STATUS, VALID_DELIVERY_PLATFORM } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { withAuth } from '@/lib/with-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';

// GET - 获取所有交付记录（支持分页）
// v3.0: 需要登录才能访问
export const GET = withAuth(async (request: NextRequest) => {
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
        return NextResponse.json({ error: `status must be one of ${VALID_DELIVERY_STATUS.join('/')}` }, { status: 400 });
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
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
});

// POST - 创建交付记录
// v3.0: 需要登录才能创建
export const POST = withAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();

    if (!body.memberId || !body.title || !body.platform) {
      return errorResponse(ApiErrors.badRequest('Missing required fields: memberId, title, platform'), requestId);
    }

    if (!validateEnum(body.platform, VALID_DELIVERY_PLATFORM)) {
      return errorResponse(ApiErrors.badRequest(`platform must be one of ${VALID_DELIVERY_PLATFORM.join('/')}`), requestId);
    }

    if (body.platform === 'local' && !body.documentId) {
      return errorResponse(ApiErrors.badRequest('Local document delivery requires a documentId'), requestId);
    }
    if (body.platform !== 'local' && !body.externalUrl) {
      return errorResponse(ApiErrors.badRequest('External document delivery requires an externalUrl'), requestId);
    }

    if (body.status !== undefined && !validateEnum(body.status, VALID_DELIVERY_STATUS)) {
      return errorResponse(ApiErrors.badRequest(`status must be one of ${VALID_DELIVERY_STATUS.join('/')}`), requestId);
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
    triggerMarkdownSync('teamclaw:deliveries');
    return createdResponse(delivery);
  } catch (error) {
    console.error(`[POST /api/deliveries] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create delivery'), requestId);
  }
});
