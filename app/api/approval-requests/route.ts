/**
 * 审批请求 API
 * 
 * GET  /api/approval-requests - 获取审批请求列表
 * POST /api/approval-requests - 创建审批请求
 */

import { db } from '@/db';
import {
  approvalRequests,
  approvalHistories,
  approvalStrategies,
  type ApprovalRequest,
  type NewApprovalRequest,
} from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { eq, and, desc, inArray } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import {
  successResponse,
  createdResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';

// 审批类型
type ApprovalType = 'skill_publish' | 'skill_install' | 'project_join' | 'sensitive_action';

// GET /api/approval-requests - 获取审批请求列表
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as ApprovalType | null;
  const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired' | null;
  const requesterId = searchParams.get('requesterId');
  const resourceId = searchParams.get('resourceId');

  try {
    let query = db.select().from(approvalRequests);

    // 构建查询条件
    const conditions = [];

    // 权限过滤：普通用户只能看自己的申请，管理员可以看全部
    if (auth.userRole !== 'admin') {
      conditions.push(eq(approvalRequests.requesterId, auth.userId!));
    }

    // 条件过滤
    if (type) {
      conditions.push(eq(approvalRequests.type, type));
    }
    if (status) {
      conditions.push(eq(approvalRequests.status, status));
    }
    if (requesterId && isValidId(requesterId)) {
      conditions.push(eq(approvalRequests.requesterId, requesterId));
    }
    if (resourceId && isValidId(resourceId)) {
      conditions.push(eq(approvalRequests.resourceId, resourceId));
    }

    // 执行查询
    const requests = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(approvalRequests.createdAt))
      : await query.orderBy(desc(approvalRequests.createdAt));

    return successResponse({ requests });
  } catch (error) {
    console.error('[Approval API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch approval requests' }, { status: 500 });
  }
});

// POST /api/approval-requests - 创建审批请求
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  try {
    const body = await request.json();
    const { type, resourceType, resourceId, payload, requestNote, expiresAt } = body;

    // 参数校验
    if (!type || !resourceType || !resourceId) {
      return NextResponse.json({ error: 'Missing required fields: type, resourceType, resourceId' }, { status: 400 });
    }

    if (!isValidId(resourceId)) {
      return NextResponse.json({ error: 'Invalid resourceId format' }, { status: 400 });
    }

    // 获取审批策略
    const [strategyConfig] = await db.select()
      .from(approvalStrategies)
      .where(eq(approvalStrategies.type, type));

    if (!strategyConfig || !strategyConfig.enabled) {
      return NextResponse.json({ error: 'Approval type not supported or disabled' }, { status: 400 });
    }

    // 检查是否已有待审批的请求
    const [existing] = await db.select()
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.type, type),
        eq(approvalRequests.resourceId, resourceId),
        eq(approvalRequests.status, 'pending')
      ));

    if (existing) {
      return NextResponse.json({ error: 'Pending request already exists for this resource' }, { status: 400 });
    }

    // 创建审批请求
    const requestId = generateId();
    const now = new Date();

    const [approvalRequest] = await db.insert(approvalRequests).values({
      id: requestId,
      type,
      resourceType,
      resourceId,
      requesterId: auth.userId!,
      payload,
      requestNote,
      status: 'pending',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdAt: now,
      updatedAt: now,
    }).returning();

    // 记录历史
    await db.insert(approvalHistories).values({
      id: generateId(),
      requestId,
      action: 'created',
      operatorId: auth.userId!,
      previousStatus: null,
      newStatus: 'pending',
      createdAt: now,
    });

    // 触发 SSE 事件
    eventBus.emit({
      type: 'approval_request_created',
      resourceId: requestId,
      data: { type, resourceType, resourceId, requesterId: auth.userId },
    });

    // TODO: 发送通知给审批人
    // await sendApprovalNotification(approvalRequest, 'created');

    return createdResponse({ request: approvalRequest });
  } catch (error) {
    console.error('[Approval API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
  }
});
