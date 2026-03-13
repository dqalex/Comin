/**
 * 数据刷新服务
 * 
 * 统一处理数据刷新请求，避免在各处直接调用 Store 的 fetchXxx 方法。
 * 使用事件驱动架构，降低 Store 之间的耦合。
 * 
 * 典型使用场景：
 * - MCP executor 执行完操作后需要刷新数据
 * - Chat channel 处理完 action 后需要刷新数据
 * - 用户操作后需要批量刷新多个数据源
 */

import { storeEvents } from '@/lib/store-events';
import {
  useTaskStore,
  useDocumentStore,
  useMemberStore,
  useProjectStore,
  useDeliveryStore,
  useMilestoneStore,
  useSOPTemplateStore,
  useRenderTemplateStore,
  useScheduledTaskStore,
  useOpenClawStatusStore,
  useChatStore,
} from '@/store';

// 数据类型到刷新方法的映射
const REFRESH_HANDLERS: Record<string, () => Promise<void>> = {
  tasks: () => useTaskStore.getState().fetchTasks(),
  documents: () => useDocumentStore.getState().fetchDocuments(),
  members: () => useMemberStore.getState().fetchMembers(),
  projects: () => useProjectStore.getState().fetchProjects(),
  deliveries: () => useDeliveryStore.getState().fetchDeliveries(),
  milestones: () => useMilestoneStore.getState().fetchMilestones(),
  sopTemplates: () => useSOPTemplateStore.getState().fetchTemplates(),
  renderTemplates: () => useRenderTemplateStore.getState().fetchTemplates(),
  scheduledTasks: () => useScheduledTaskStore.getState().fetchTasks(),
  status: () => useOpenClawStatusStore.getState().fetchStatus(),
  chatSessions: () => useChatStore.getState().fetchSessions(),
};

/**
 * 刷新单个数据源
 */
export async function refreshData(
  type: keyof typeof REFRESH_HANDLERS,
  reason?: string
): Promise<void> {
  const handler = REFRESH_HANDLERS[type];
  if (handler) {
    try {
      await handler();
      if (reason) {
        console.log(`[DataRefresh] ${type} refreshed: ${reason}`);
      }
    } catch (error) {
      console.error(`[DataRefresh] Failed to refresh ${type}:`, error);
    }
  } else {
    console.warn(`[DataRefresh] Unknown data type: ${type}`);
  }
}

/**
 * 批量刷新多个数据源
 */
export async function refreshMultiple(
  types: (keyof typeof REFRESH_HANDLERS)[],
  reason?: string
): Promise<void> {
  await Promise.allSettled(types.map(type => refreshData(type)));
  if (reason) {
    console.log(`[DataRefresh] Batch refresh completed: ${reason}`);
  }
}

/**
 * 订阅数据刷新事件
 * 在应用初始化时调用
 */
export function subscribeToDataRefreshEvents(): () => void {
  return storeEvents.on('data:refresh', async (payload) => {
    await refreshData(payload.type, payload.reason);
  });
}

// 在浏览器环境下自动订阅
if (typeof window !== 'undefined') {
  subscribeToDataRefreshEvents();
}
