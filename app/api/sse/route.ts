/**
 * SSE 端点 - Server-Sent Events 长连接
 * 
 * 前端通过 EventSource 连接此端点，实时接收数据变更事件。
 * 事件类型：openclaw_status, task_update, delivery_update, schedule_update, document_update, member_update
 * 
 * v3.0: 需要登录才能连接（防止未授权订阅实时事件）
 */

import { eventBus } from '@/lib/event-bus';
import { verifyAuth } from '@/lib/api-auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // SSE 端点使用内联认证检查（因为需要返回 ReadableStream）
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('cms_session')?.value;
    
    const auth = await verifyAuth(sessionCookie || null, null);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: 'Not logged in', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    let registeredClientId: string | null = null;

    const stream = new ReadableStream({
      start(controller) {
        try {
          registeredClientId = eventBus.addClient(controller);
        } catch (err) {
          // 连接数超限时关闭流
          const errMsg = err instanceof Error ? err.message : 'SSE connection rejected';
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`));
          controller.close();
          return;
        }

        const welcome = `event: connected\ndata: ${JSON.stringify({ clientId: registeredClientId, timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(welcome));
      },
      cancel() {
        if (registeredClientId) {
          eventBus.removeClient(registeredClientId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[SSE] GET /api/sse error:', error);
    return new Response(JSON.stringify({ error: 'SSE connection failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
