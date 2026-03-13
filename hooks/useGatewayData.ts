/**
 * Gateway 数据订阅 Hook
 *
 * 集中管理 Gateway 相关数据订阅
 *
 * 使用示例：
 * ```typescript
 * const { agents, sessions, skills, isConnected, refreshAgents } = useGatewayData();
 * ```
 */
import { useCallback, useMemo } from 'react';
import { useGatewayStore } from '@/store/gateway.store';

export interface GatewayData {
  // 连接状态
  isConnected: boolean;
  connectionMode: 'server_proxy' | null;
  error: string | null;
  gwUrl: string;

  // 数据
  agentsList: ReturnType<typeof useGatewayStore.getState>['agentsList'];
  agentsDefaultId: string | null;
  sessions: ReturnType<typeof useGatewayStore.getState>['sessions'];
  sessionsCount: number;
  skills: ReturnType<typeof useGatewayStore.getState>['skills'];
  cronJobs: ReturnType<typeof useGatewayStore.getState>['cronJobs'];
  snapshot: ReturnType<typeof useGatewayStore.getState>['snapshot'];
  health: ReturnType<typeof useGatewayStore.getState>['health'];

  // 加载状态
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  configForm: Record<string, unknown> | null;

  // 刷新方法
  refreshAgents: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  refreshCronJobs: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  refreshHealth: () => Promise<void>;

  // 操作方法
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  updateConfigForm: (updater: (form: Record<string, unknown>) => Record<string, unknown>) => void;
}

export function useGatewayData(): GatewayData {
  // 连接状态
  const isConnected = useGatewayStore((s) => s.serverProxyConnected);
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const error = useGatewayStore((s) => s.error);
  const gwUrl = useGatewayStore((s) => s.gwUrl);

  // 数据
  const agentsList = useGatewayStore((s) => s.agentsList);
  const agentsDefaultId = useGatewayStore((s) => s.agentsDefaultId);
  const sessions = useGatewayStore((s) => s.sessions);
  const sessionsCount = useGatewayStore((s) => s.sessionsCount);
  const skills = useGatewayStore((s) => s.skills);
  const cronJobs = useGatewayStore((s) => s.cronJobs);
  const snapshot = useGatewayStore((s) => s.snapshot);
  const health = useGatewayStore((s) => s.health);

  // 配置状态
  const configLoading = useGatewayStore((s) => s.configLoading);
  const configSaving = useGatewayStore((s) => s.configSaving);
  const configDirty = useGatewayStore((s) => s.configDirty);
  const configForm = useGatewayStore((s) => s.configForm);

  // 刷新方法
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const refreshSnapshot = useGatewayStore((s) => s.refreshSnapshot);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);

  // 配置方法
  const loadConfig = useGatewayStore((s) => s.loadConfig);
  const saveConfig = useGatewayStore((s) => s.saveConfig);
  const updateConfigForm = useGatewayStore((s) => s.updateConfigForm);

  return {
    isConnected,
    connectionMode,
    error,
    gwUrl,
    agentsList,
    agentsDefaultId,
    sessions,
    sessionsCount,
    skills,
    cronJobs,
    snapshot,
    health,
    configLoading,
    configSaving,
    configDirty,
    configForm,
    refreshAgents,
    refreshSessions,
    refreshSkills,
    refreshCronJobs,
    refreshSnapshot,
    refreshHealth,
    loadConfig,
    saveConfig,
    updateConfigForm,
  };
}

/**
 * 仅获取默认 Agent
 */
export function useDefaultAgent() {
  const agentsList = useGatewayStore((s) => s.agentsList);
  const agentsDefaultId = useGatewayStore((s) => s.agentsDefaultId);

  return useMemo(() => {
    return agentsList.find((a) => a.id === agentsDefaultId) || agentsList[0] || null;
  }, [agentsList, agentsDefaultId]);
}

/**
 * 获取启用的技能列表
 */
export function useEnabledSkills() {
  const skills = useGatewayStore((s) => s.skills);
  return useMemo(() => skills.filter((s) => !s.disabled), [skills]);
}

/**
 * 获取启用的定时任务
 */
export function useEnabledCronJobs() {
  const cronJobs = useGatewayStore((s) => s.cronJobs);
  return useMemo(() => cronJobs.filter((j) => j.enabled), [cronJobs]);
}

/**
 * 获取 Agent 健康状态
 */
export function useAgentHealth(agentId: string) {
  const health = useGatewayStore((s) => s.health);

  return useMemo(() => {
    if (!health?.agents) return null;
    return health.agents.find((a) => a.agentId === agentId) || null;
  }, [health, agentId]);
}

/**
 * 刷新所有 Gateway 数据
 */
export function useRefreshAllGatewayData() {
  const refreshSnapshot = useGatewayStore((s) => s.refreshSnapshot);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);

  return useCallback(async () => {
    await Promise.allSettled([
      refreshSnapshot(),
      refreshHealth(),
      refreshAgents(),
      refreshCronJobs(),
      refreshSessions(),
      refreshSkills(),
    ]);
  }, [
    refreshSnapshot,
    refreshHealth,
    refreshAgents,
    refreshCronJobs,
    refreshSessions,
    refreshSkills,
  ]);
}
