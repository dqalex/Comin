/**
 * 服务端事件总线 - SSE 广播器
 */

// 从集中管理文件导出事件类型
export type { SSEEventType, SSEEvent } from './sse-events';

import type { SSEEvent } from './sse-events';

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class EventBus {
  private clients: Map<string, SSEClient> = new Map();
  private clientCounter = 0;
  private encoder = new TextEncoder();
  // SSE 最大并发连接数限制
  private static readonly MAX_CLIENTS = 50;

  addClient(controller: ReadableStreamDefaultController): string {
    // 超过最大连接数时拒绝新连接
    if (this.clients.size >= EventBus.MAX_CLIENTS) {
      throw new Error(`SSE max clients exceeded (${EventBus.MAX_CLIENTS})`);
    }
    const id = `sse_${++this.clientCounter}_${Date.now()}`;
    this.clients.set(id, { id, controller });
    return id;
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  emit(event: Omit<SSEEvent, 'timestamp'>): void {
    const fullEvent: SSEEvent = { ...event, timestamp: Date.now() };
    const payload = `event: ${fullEvent.type}\ndata: ${JSON.stringify(fullEvent)}\n\n`;
    const encoded = this.encoder.encode(payload);
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        deadClients.push(clientId);
      }
    }

    for (const id of deadClients) {
      this.clients.delete(id);
    }
  }

  heartbeat(): void {
    const payload = `: heartbeat ${Date.now()}\n\n`;
    const encoded = this.encoder.encode(payload);
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        deadClients.push(clientId);
      }
    }

    for (const id of deadClients) {
      this.clients.delete(id);
    }
  }
}

const globalKey = '__teamclaw_event_bus__';
const heartbeatKey = '__teamclaw_heartbeat_timer__';

function getEventBus(): EventBus {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = new EventBus();
  }
  return (globalThis as Record<string, unknown>)[globalKey] as EventBus;
}

export const eventBus = getEventBus();

/**
 * 启动心跳定时器（带防止重复启动保护）
 * 在服务器热重载时不会累积定时器
 */
function startHeartbeat(): void {
  const globalObj = globalThis as Record<string, unknown>;
  
  // 如果已有定时器在运行，先清理
  if (globalObj[heartbeatKey]) {
    clearInterval(globalObj[heartbeatKey] as ReturnType<typeof setInterval>);
  }
  
  // 启动新的心跳定时器
  globalObj[heartbeatKey] = setInterval(() => {
    eventBus.heartbeat();
  }, 30_000);
  
  // 确保进程退出时清理定时器（使用 once 防止重复注册）
  if (typeof process !== 'undefined') {
    const cleanup = () => {
      if (globalObj[heartbeatKey]) {
        clearInterval(globalObj[heartbeatKey] as ReturnType<typeof setInterval>);
        globalObj[heartbeatKey] = null;
      }
    };
    
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);
    process.once('beforeExit', cleanup);
  }
}

startHeartbeat();
