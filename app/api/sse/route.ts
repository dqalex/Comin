/**
 * SSE 端点 - Server-Sent Events 长连接
 * 
 * 前端通过 EventSource 连接此端点，实时接收数据变更事件。
 * 事件类型：openclaw_status, task_update, delivery_update, schedule_update, document_update, member_update
 */

import { eventBus } from '@/lib/event-bus';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const encoder = new TextEncoder();
    let registeredClientId: string | null = null;

    const stream = new ReadableStream({
      start(controller) {
        registeredClientId = eventBus.addClient(controller);

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
    return new Response(JSON.stringify({ error: 'SSE 连接失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
