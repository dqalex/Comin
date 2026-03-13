'use client';

import { useRef, useCallback, useEffect } from 'react';
import { SSE_EVENT_TYPES, sseHandlerRegistry, createSSEListener } from '@/lib/sse-events';
import type { SSEEventType } from '@/lib/sse-events';
import { logger } from '@/lib/logger';

interface SSEConnectionOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * SSE 连接管理 Hook
 * 
 * 职责：
 * - 建立和维护 SSE 长连接
 * - 自动重连（指数退避）
 * - 事件监听和分发
 */
export function useSSEConnection(options: SSEConnectionOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  
  const MAX_RECONNECT_DELAY = 60000; // 最大 60 秒
  const BASE_RECONNECT_DELAY = 1000; // 基础 1 秒

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      const es = eventSourceRef.current as EventSource & { _cleanup?: () => void };
      if (es._cleanup) {
        es._cleanup();
      }
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    // 不在这里清空处理器！处理器由 DataProvider 管理，重连时应该保留
    // sseHandlerRegistry.clear();
    logger.info('[SSE] Disconnected');
  }, []);

  const connect = useCallback(() => {
    // 如果已连接，先断开
    if (eventSourceRef.current) {
      disconnect();
    }

    try {
      const es = new EventSource('/api/sse');
      eventSourceRef.current = es;

      // 使用集中定义的 SSE 监听器
      const cleanup = createSSEListener(es, (type, data) => {
        sseHandlerRegistry.handle(type, data);
      });

      // 保存清理函数以便后续调用
      (es as EventSource & { _cleanup?: () => void })._cleanup = cleanup;

      // 连接成功后重置重连计数
      es.onopen = () => {
        reconnectAttempts.current = 0;
        logger.info('[SSE] Connected');
        options.onConnect?.();
      };

      es.onerror = (error) => {
        es.close();
        eventSourceRef.current = null;
        
        logger.warn('[SSE] Connection error, will reconnect');
        options.onError?.(error);

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        
        // 指数退避重连：1s, 2s, 4s, 8s, ... 最大 60s
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttempts.current += 1;
        
        reconnectTimerRef.current = setTimeout(() => {
          if (document.visibilityState === 'visible') {
            connect();
          }
        }, delay);
      };

      return () => disconnect();
    } catch (error) {
      logger.error('[SSE] Failed to connect:', error);
      options.onError?.(error as Event);
      return undefined;
    }
  }, [disconnect, options]);

  // 组件卸载时清理
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected: () => eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnectAttempts: () => reconnectAttempts.current,
  };
}

export type { SSEConnectionOptions };
