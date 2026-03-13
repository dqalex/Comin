/**
 * 取消审批请求 API
 * 
 * POST /api/approval-requests/[id]/cancel - 取消审批请求（申请人自己取消）
 */

import { db } from '@/db';
import { approvalRequests, approvalHistories } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由
export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth, type AuthResult, type RouteContext } from '@/lib/with-auth';
import { isValidId } from '@/lib/security';
import { successResponse } from '@/lib/api-route-factory';

// POST /api/approval-requests/[id]/cancel - 取消审批请求
export const POST = withAuth(
  async (request: NextRequest, auth: AuthResult, context?: RouteContext<{ id: string }>): Promise<NextResponse> => {
    try {
      const { id } = await context!.params;

      if (!isValidId(id)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
      }

      const body = await request.json();
      const { note } = body;

      // 获取审批请求
      const [approvalRequest] = await db.select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, id));

      if (!approvalRequest) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
      }

      // 权限检查：只能取消自己的申请，管理员可以取消任何人的申请
      if (approvalRequest.requesterId !== auth.userId && auth.userRole !== 'admin') {
        return NextResponse.json({ error: 'Cannot cancel others request' }, { status: 403 });
      }

      if (approvalRequest.status !== 'pending') {
        return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
      }

      const now = new Date();

      // 执行取消逻辑（事务）
      await db.transaction(async (tx) => {
        // 更新审批请求状态
        await tx.update(approvalRequests)
          .set({
            status: 'cancelled',
            updatedAt: now,
          })
          .where(eq(approvalRequests.id, id));

        // 记录历史
        await tx.insert(approvalHistories).values({
          id: generateId(),
          requestId: id,
          action: 'cancelled',
          operatorId: auth.userId!,
          previousStatus: 'pending',
          newStatus: 'cancelled',
          note,
          createdAt: now,
        });
      });

      // 触发 SSE 事件
      eventBus.emit({
        type: 'approval_request_cancelled',
        resourceId: id,
        data: {
          type: approvalRequest.type,
          resourceId: approvalRequest.resourceId,
          requesterId: approvalRequest.requesterId,
        },
      });

      return successResponse({ success: true });
    } catch (error) {
      console.error('[Approval API] Cancel error:', error);
      return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
    }
  }
);
