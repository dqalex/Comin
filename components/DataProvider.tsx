'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDataInitializer } from '@/store';
import {
  useOpenClawStatusStore,
  useTaskStore,
  useDeliveryStore,
  useScheduledTaskStore,
  useDocumentStore,
  useMemberStore,
  useProjectStore,
  useMilestoneStore,
  useSOPTemplateStore,
  useRenderTemplateStore,
} from '@/store';
import { useGatewayStore } from '@/store/gateway.store';
import { useChatStore } from '@/store/chat.store';
import type { SSEEventType } from '@/lib/event-bus';
import type { ChatEventPayload } from '@/types';

/**
 * 数据初始化 Provider
 * - 首次加载时从 API 加载所有数据
 * - 建立 SSE 长连接，实时接收服务端事件并刷新对应 Store
 * - 标签页重新可见时自动重新同步
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { initialize, hydrated } = useDataInitializer();
  const initialized = useRef(false);
  const lastSyncAt = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SSE 指数退避重连计数器
  const reconnectAttempts = useRef(0);
  const MAX_SSE_RECONNECT_DELAY = 60000; // 最大 60 秒
  const BASE_SSE_RECONNECT_DELAY = 1000; // 基础 1 秒

  const fetchOpenClawStatus = useOpenClawStatusStore((s) => s.fetchStatus);
  const checkStaleStatus = useOpenClawStatusStore((s) => s.checkStaleStatus);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchDeliveries = useDeliveryStore((s) => s.fetchDeliveries);
  const fetchScheduledTasks = useScheduledTaskStore((s) => s.fetchTasks);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchChatSessions = useChatStore((s) => s.fetchSessions);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchMilestones = useMilestoneStore((s) => s.fetchMilestones);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);
  const fetchRenderTemplates = useRenderTemplateStore((s) => s.fetchTemplates);

  // Gateway Store 刷新方法（server_proxy 模式下使用）
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const loadConfig = useGatewayStore((s) => s.loadConfig);
  const syncServerProxyStatus = useGatewayStore((s) => s.syncServerProxyStatus);
  const dispatchChatEvent = useGatewayStore((s) => s.dispatchChatEvent);

  const eventHandlers = useRef<Record<SSEEventType, (data?: unknown) => void>>({
    openclaw_status: () => fetchOpenClawStatus(),
    task_update: () => { fetchTasks(); fetchProjects(); },
    delivery_update: () => fetchDeliveries(),
    schedule_update: () => fetchScheduledTasks(),
    document_update: () => fetchDocuments(),
    member_update: () => fetchMembers(),
    project_update: () => fetchProjects(),
    chat_session_update: () => fetchChatSessions(),
    milestone_update: () => fetchMilestones(),
    // Gateway 服务端代理事件（REQ-003）
    gateway_event: () => {
      // 通用 Gateway 事件，刷新所有数据
      refreshAgents();
      refreshSessions();
      refreshCronJobs();
      refreshSkills();
    },
    gateway_agent_update: () => refreshAgents(),
    gateway_session_update: () => refreshSessions(),
    gateway_chat_event: (data?: unknown) => {
      // 聊天事件：解析 payload 并分发给 chatEventHandlers
      if (data) {
        const eventData = data as { gatewayEvent?: string; payload?: ChatEventPayload };
        if (eventData.payload) {
          dispatchChatEvent(eventData.payload);
          // 仅在对话结束（final）时刷新会话列表，delta 时不刷新（避免高频无效请求）
          if (eventData.payload.state === 'final') {
            refreshSessions();
          }
        }
      }
    },
    gateway_cron_update: () => refreshCronJobs(),
    gateway_config_update: () => loadConfig(),
    gateway_status_update: () => {
      // 状态更新，同步连接状态并刷新健康状态
      syncServerProxyStatus();
      refreshHealth();
    },
    // v3.0 SOP 和渲染模板事件
    sop_template_update: () => fetchSOPTemplates(),
    render_template_update: () => fetchRenderTemplates(),
    sop_confirm_request: () => { fetchTasks(); },
  });

  useEffect(() => {
    eventHandlers.current = {
      openclaw_status: () => fetchOpenClawStatus(),
      task_update: () => { fetchTasks(); fetchProjects(); },
      delivery_update: () => fetchDeliveries(),
      schedule_update: () => fetchScheduledTasks(),
      document_update: () => fetchDocuments(),
      member_update: () => fetchMembers(),
      project_update: () => fetchProjects(),
      chat_session_update: () => fetchChatSessions(),
      milestone_update: () => fetchMilestones(),
      // Gateway 服务端代理事件（REQ-003）
      gateway_event: () => {
        refreshAgents();
        refreshSessions();
        refreshCronJobs();
        refreshSkills();
      },
      gateway_agent_update: () => refreshAgents(),
      gateway_session_update: () => refreshSessions(),
      gateway_chat_event: (data?: unknown) => {
        if (data) {
          const eventData = data as { gatewayEvent?: string; payload?: ChatEventPayload };
          if (eventData.payload) {
            dispatchChatEvent(eventData.payload);
            if (eventData.payload.state === 'final') {
              refreshSessions();
            }
          }
        }
      },
      gateway_cron_update: () => refreshCronJobs(),
      gateway_config_update: () => loadConfig(),
      gateway_status_update: () => {
        syncServerProxyStatus();
        refreshHealth();
      },
      // v3.0 SOP 和渲染模板事件
      sop_template_update: () => fetchSOPTemplates(),
      render_template_update: () => fetchRenderTemplates(),
      sop_confirm_request: () => { fetchTasks(); },
    };
  }, [fetchOpenClawStatus, fetchTasks, fetchProjects, fetchDeliveries, fetchScheduledTasks, fetchDocuments, fetchMembers, fetchMilestones, fetchChatSessions, refreshAgents, refreshSessions, refreshCronJobs, refreshSkills, refreshHealth, loadConfig, syncServerProxyStatus, dispatchChatEvent, fetchSOPTemplates, fetchRenderTemplates]);

  const sync = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncAt.current < 3000) return;
    lastSyncAt.current = now;
    initialize();
  }, [initialize]);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource('/api/sse');
    eventSourceRef.current = es;

    const eventTypes: SSEEventType[] = [
      'openclaw_status', 'task_update', 'delivery_update',
      'schedule_update', 'document_update', 'member_update', 'chat_session_update',
      'milestone_update',
      // Gateway 服务端代理事件（REQ-003）
      'gateway_event', 'gateway_agent_update', 'gateway_session_update',
      'gateway_chat_event', 'gateway_cron_update', 'gateway_config_update',
      'gateway_status_update',
      // v3.0 SOP 和渲染模板事件
      'sop_template_update', 'render_template_update', 'sop_confirm_request',
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (event: MessageEvent) => {
        const handler = eventHandlers.current[type];
        if (handler) {
          // 解析 SSE data 中的 payload（gateway_chat_event 需要完整数据）
          let eventData: unknown = undefined;
          if (event.data) {
            try {
              const parsed = JSON.parse(event.data);
              eventData = parsed.data;
            } catch {
              // 解析失败忽略
            }
          }
          handler(eventData);
        }
      });
    }

    // 连接成功后重置重连计数并同步数据（弥补断线期间可能丢失的事件）
    es.onopen = () => {
      reconnectAttempts.current = 0;
      sync();
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      // 指数退避重连：1s, 2s, 4s, 8s, ... 最大 60s
      const delay = Math.min(
        BASE_SSE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
        MAX_SSE_RECONNECT_DELAY
      );
      reconnectAttempts.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          connectSSE();
        }
      }, delay);
    };
  }, []);

  useEffect(() => {
    if (hydrated && !initialized.current) {
      initialized.current = true;
      lastSyncAt.current = Date.now();
      initialize();
      connectSSE();
      // Gateway 状态同步
      (async () => {
        try {
          const res = await fetch('/api/gateway/config');
          const json = await res.json();
          const data = json.data;
          if (data) {
            const gwStore = useGatewayStore.getState();
            // 直接设置连接信息，避免重复 fetch
            gwStore.setConnectionInfo(data.mode, data.status, data.url);
            if (data.mode === 'browser_direct') {
              // browser_direct 模式下尝试浏览器直连（连接成功后自动加载数据）
              gwStore.tryAutoConnect();
            } else if (data.mode === 'server_proxy' && data.status === 'connected') {
              // server_proxy 模式下主动加载所有 Gateway 数据
              Promise.allSettled([
                gwStore.refreshAgents(),
                gwStore.refreshHealth(),
                gwStore.refreshCronJobs(),
                gwStore.refreshSessions(),
                gwStore.refreshSkills(),
                gwStore.loadConfig(),
              ]).then(results => {
                const names = ['agents', 'health', 'cronJobs', 'sessions', 'skills', 'config'];
                results.forEach((r, i) => {
                  if (r.status === 'rejected') console.warn(`[DataProvider] server_proxy ${names[i]} refresh failed:`, r.reason);
                });
              });
            }
          }
        } catch {
          // 配置获取失败，跳过
        }
      })();
      // 启动 .comind-index 心跳（服务端幂等，仅首次生效）
      fetch('/api/heartbeat/start', { method: 'POST' }).catch(() => {});
    }
  }, [hydrated, initialize, connectSSE]);

  // 定时检查超时的 working 状态（每 60 秒），自动将断线 Agent 重置为 offline
  const staleCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    // 启动后 30 秒进行首次检查，之后每 60 秒检查一次
    const initialTimer = setTimeout(() => {
      checkStaleStatus();
      staleCheckTimerRef.current = setInterval(() => {
        checkStaleStatus();
      }, 60000);
    }, 30000);
    return () => {
      clearTimeout(initialTimer);
      if (staleCheckTimerRef.current) {
        clearInterval(staleCheckTimerRef.current);
      }
    };
  }, [hydrated, checkStaleStatus]);

  useEffect(() => {
    if (!hydrated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && initialized.current) {
        sync();
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    };

    const handleFocus = () => {
      if (initialized.current) {
        sync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [hydrated, sync, connectSSE]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (staleCheckTimerRef.current) {
        clearInterval(staleCheckTimerRef.current);
      }
    };
  }, []);

  return <>{children}</>;
}
