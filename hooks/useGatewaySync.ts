'use client';

import { useCallback } from 'react';
import { useGatewayStore } from '@/store/gateway.store';
import { logger } from '@/lib/logger';

interface GatewayConfig {
  mode: 'server_proxy' | null;
  status: 'connected' | 'disconnected' | null;
  url: string;
}

interface GatewaySyncResult {
  success: boolean;
  error?: string;
  data?: GatewayConfig;
}

/**
 * Gateway 数据同步 Hook
 * 
 * 职责：
 * - 获取 Gateway 配置
 * - 同步 Gateway 状态（server_proxy 模式）
 * - 加载 Gateway 数据（agents, health, cronJobs, sessions, skills, config）
 */
export function useGatewaySync() {
  const setConnectionInfo = useGatewayStore((s) => s.setConnectionInfo);
  const refreshAgents = useGatewayStore((s) => s.refreshAgents);
  const refreshSessions = useGatewayStore((s) => s.refreshSessions);
  const refreshCronJobs = useGatewayStore((s) => s.refreshCronJobs);
  const refreshSkills = useGatewayStore((s) => s.refreshSkills);
  const refreshHealth = useGatewayStore((s) => s.refreshHealth);
  const loadConfig = useGatewayStore((s) => s.loadConfig);

  /**
   * 获取 Gateway 配置
   */
  const fetchConfig = useCallback(async (): Promise<GatewaySyncResult> => {
    try {
      const res = await fetch('/api/gateway/config');
      const json = await res.json();
      const data = json.data as GatewayConfig | undefined;
      
      if (!data) {
        return { success: false, error: 'No config data' };
      }

      return { success: true, data };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[GatewaySync] Failed to fetch config:', error);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * 同步 Gateway 状态并加载数据
   * 仅在 server_proxy 模式下且已连接时加载数据
   */
  const syncGateway = useCallback(async (): Promise<GatewaySyncResult> => {
    const configResult = await fetchConfig();
    
    if (!configResult.success || !configResult.data) {
      return configResult;
    }

    const { mode, status, url } = configResult.data;
    
    // 设置连接信息
    setConnectionInfo(mode, status, url);
    
    logger.info(`[GatewaySync] Mode: ${mode}, Status: ${status}`);

    // server_proxy 模式下主动加载所有 Gateway 数据
    if (mode === 'server_proxy' && status === 'connected') {
      logger.info('[GatewaySync] Loading Gateway data...');
      
      const results = await Promise.allSettled([
        refreshAgents(),
        refreshHealth(),
        refreshCronJobs(),
        refreshSessions(),
        refreshSkills(),
        loadConfig(),
      ]);

      const names = ['agents', 'health', 'cronJobs', 'sessions', 'skills', 'config'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          logger.warn(`[GatewaySync] ${names[i]} refresh failed:`, r.reason);
        }
      });

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        logger.warn(`[GatewaySync] ${failedCount} operations failed`);
      }
    }

    return configResult;
  }, [fetchConfig, setConnectionInfo, refreshAgents, refreshHealth, refreshCronJobs, refreshSessions, refreshSkills, loadConfig]);

  /**
   * 仅刷新 Gateway 数据（不重新获取配置）
   */
  const refreshGatewayData = useCallback(async (): Promise<void> => {
    const state = useGatewayStore.getState();
    const { connectionMode, serverProxyConnected } = state;

    if (connectionMode !== 'server_proxy' || !serverProxyConnected) {
      logger.debug('[GatewaySync]', 'Skipping refresh - not in server_proxy mode or not connected');
      return;
    }

    const results = await Promise.allSettled([
      refreshAgents(),
      refreshHealth(),
      refreshCronJobs(),
      refreshSessions(),
      refreshSkills(),
    ]);

    const names = ['agents', 'health', 'cronJobs', 'sessions', 'skills'];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.warn(`[GatewaySync] ${names[i]} refresh failed:`, r.reason);
      }
    });
  }, [refreshAgents, refreshHealth, refreshCronJobs, refreshSessions, refreshSkills]);

  return {
    fetchConfig,
    syncGateway,
    refreshGatewayData,
  };
}

export type { GatewayConfig, GatewaySyncResult };
