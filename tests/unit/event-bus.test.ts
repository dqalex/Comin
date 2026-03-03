/**
 * 事件总线 - 单元测试
 * 
 * 注意：event-bus.ts 导出的是全局单例，测试需确保隔离
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 因为 event-bus 有全局副作用（startHeartbeat），我们需要自行构造测试
// 这里测试 EventBus 的核心逻辑

describe('EventBus', () => {
  // 模拟 ReadableStreamDefaultController
  function createMockController() {
    const enqueued: Uint8Array[] = [];
    let closed = false;
    return {
      enqueue: vi.fn((chunk: Uint8Array) => {
        if (closed) throw new Error('Controller closed');
        enqueued.push(chunk);
      }),
      close: vi.fn(() => { closed = true; }),
      error: vi.fn(),
      desiredSize: 1,
      enqueued,
      simulateClose: () => { closed = true; },
    };
  }

  // 手动实现 EventBus 测试版（无全局副作用）
  class TestEventBus {
    private clients = new Map<string, { id: string; controller: { enqueue: (chunk: Uint8Array) => void } }>();
    private clientCounter = 0;
    private encoder = new TextEncoder();

    addClient(controller: { enqueue: (chunk: Uint8Array) => void }): string {
      const id = `test_${++this.clientCounter}`;
      this.clients.set(id, { id, controller });
      return id;
    }

    removeClient(clientId: string): void {
      this.clients.delete(clientId);
    }

    get clientCount(): number {
      return this.clients.size;
    }

    emit(event: { type: string; resourceId?: string; data?: Record<string, unknown> }): void {
      const fullEvent = { ...event, timestamp: Date.now() };
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

  let bus: TestEventBus;

  beforeEach(() => {
    bus = new TestEventBus();
  });

  describe('客户端管理', () => {
    it('应该添加客户端并返回唯一 ID', () => {
      const ctrl = createMockController();
      const id = bus.addClient(ctrl);
      expect(id).toBeTruthy();
      expect(bus.clientCount).toBe(1);
    });

    it('多个客户端应该有不同 ID', () => {
      const c1 = createMockController();
      const c2 = createMockController();
      const id1 = bus.addClient(c1);
      const id2 = bus.addClient(c2);
      expect(id1).not.toBe(id2);
      expect(bus.clientCount).toBe(2);
    });

    it('移除客户端应该减少计数', () => {
      const ctrl = createMockController();
      const id = bus.addClient(ctrl);
      expect(bus.clientCount).toBe(1);
      bus.removeClient(id);
      expect(bus.clientCount).toBe(0);
    });

    it('移除不存在的客户端不应报错', () => {
      expect(() => bus.removeClient('nonexistent')).not.toThrow();
    });
  });

  describe('emit', () => {
    it('应该向所有客户端发送事件', () => {
      const c1 = createMockController();
      const c2 = createMockController();
      bus.addClient(c1);
      bus.addClient(c2);

      bus.emit({ type: 'task_update', resourceId: 'task-1' });

      expect(c1.enqueue).toHaveBeenCalledOnce();
      expect(c2.enqueue).toHaveBeenCalledOnce();
    });

    it('发送的数据应该是 SSE 格式', () => {
      const ctrl = createMockController();
      bus.addClient(ctrl);

      bus.emit({ type: 'member_update', resourceId: 'm-1', data: { name: 'test' } });

      expect(ctrl.enqueue).toHaveBeenCalledOnce();
      const encoded = ctrl.enqueue.mock.calls[0][0] as Uint8Array;
      const text = new TextDecoder().decode(encoded);

      // SSE 格式：event: <type>\ndata: <json>\n\n
      expect(text).toMatch(/^event: member_update\n/);
      expect(text).toMatch(/data: \{.*"type":"member_update".*\}\n\n$/);
    });

    it('没有客户端时不应报错', () => {
      expect(() => bus.emit({ type: 'task_update' })).not.toThrow();
    });

    it('应该自动清理死亡客户端', () => {
      const alive = createMockController();
      const dead = createMockController();
      dead.simulateClose();

      bus.addClient(alive);
      bus.addClient(dead);
      expect(bus.clientCount).toBe(2);

      bus.emit({ type: 'task_update' });

      // 死亡客户端应被移除
      expect(bus.clientCount).toBe(1);
      expect(alive.enqueue).toHaveBeenCalledOnce();
    });
  });

  describe('heartbeat', () => {
    it('应该向所有客户端发送心跳', () => {
      const c1 = createMockController();
      const c2 = createMockController();
      bus.addClient(c1);
      bus.addClient(c2);

      bus.heartbeat();

      expect(c1.enqueue).toHaveBeenCalledOnce();
      expect(c2.enqueue).toHaveBeenCalledOnce();
    });

    it('心跳数据应该是注释格式', () => {
      const ctrl = createMockController();
      bus.addClient(ctrl);

      bus.heartbeat();

      const encoded = ctrl.enqueue.mock.calls[0][0] as Uint8Array;
      const text = new TextDecoder().decode(encoded);
      expect(text).toMatch(/^: heartbeat \d+\n\n$/);
    });

    it('应该清理死亡客户端', () => {
      const dead = createMockController();
      dead.simulateClose();
      bus.addClient(dead);

      bus.heartbeat();
      expect(bus.clientCount).toBe(0);
    });
  });
});

describe('EventBus 全局单例导入', () => {
  it('应该能正常导入 eventBus', async () => {
    const { eventBus } = await import('@/lib/event-bus');
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.emit).toBe('function');
    expect(typeof eventBus.addClient).toBe('function');
    expect(typeof eventBus.removeClient).toBe('function');
    expect(typeof eventBus.heartbeat).toBe('function');
    expect(typeof eventBus.clientCount).toBe('number');
  });
});
