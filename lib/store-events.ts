/**
 * Store 间事件总线
 * 
 * 用于 Store 之间的解耦通信，避免直接跨 Store 调用。
 * 典型场景：UI 状态同步、跨 Store 动作触发。
 * 
 * 与 SSE eventBus 的区别：
 * - SSE eventBus：服务端 → 客户端（数据变更通知）
 * - storeEvents：Store ↔ Store（前端内部通信）
 */

// Store 事件类型
export type StoreEventType =
  | 'ui:chatOpen'           // 聊天面板开关
  | 'ui:chatNavigate'       // 聊天导航请求
  | 'data:refresh'          // 数据刷新请求
  | 'member:aiRegistered'   // AI 成员注册完成
  | 'gateway:statusChange'; // Gateway 连接状态变化

// Store 事件载荷
export interface StoreEventPayloads {
  'ui:chatOpen': { open: boolean };
  'ui:chatNavigate': { 
    message?: string; 
    memberId?: string; 
    sessionKey?: string;
  };
  'data:refresh': { 
    type: 'tasks' | 'documents' | 'members' | 'projects' | 'deliveries' | 'milestones' | 'sopTemplates' | 'renderTemplates' | 'scheduledTasks' | 'status' | 'chatSessions';
    reason?: string;
  };
  'member:aiRegistered': { memberId: string; agentId: string };
  'gateway:statusChange': { connected: boolean; mode: string };
}

// 事件处理器类型
type StoreEventHandler<T extends StoreEventType> = (payload: StoreEventPayloads[T]) => void;

// 使用 any 类型简化内部实现，外部类型安全
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (payload: any) => void;

class StoreEventBus {
  private subscribers: Map<StoreEventType, Set<AnyHandler>> = new Map();

  /**
   * 订阅 Store 事件
   */
  on<K extends StoreEventType>(
    event: K, 
    handler: StoreEventHandler<K>
  ): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(handler as AnyHandler);
    
    // 返回取消订阅函数
    return () => {
      this.subscribers.get(event)?.delete(handler as AnyHandler);
    };
  }

  /**
   * 发送 Store 事件
   */
  emit<K extends StoreEventType>(
    event: K, 
    payload: StoreEventPayloads[K]
  ): void {
    const handlers = this.subscribers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[StoreEvents] Handler error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * 清除所有订阅（用于测试）
   */
  clearAll(): void {
    this.subscribers.clear();
  }

  /**
   * 获取事件订阅数量（用于调试）
   */
  getSubscriberCount(event: StoreEventType): number {
    return this.subscribers.get(event)?.size || 0;
  }
}

// 全局单例
export const storeEvents = new StoreEventBus();

// 便捷订阅钩子（可在组件中使用）
export function subscribeToStoreEvent<K extends StoreEventType>(
  event: K,
  handler: StoreEventHandler<K>
): () => void {
  return storeEvents.on(event, handler);
}
