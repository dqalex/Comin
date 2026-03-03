'use client';

import { useEffect } from 'react';
import { useGatewayStore } from '@/store/gateway.store';
import { WifiOff, Settings } from 'lucide-react';
import Link from 'next/link';

/**
 * 统一的 Gateway 断连空状态引导组件
 * 所有 Gateway 依赖页面使用此组件包裹
 *
 * 直接读取 gateway store 状态（DataProvider 已在应用启动时初始化）
 * 不再主动 fetch /api/gateway/config，避免 ~1s 的页面阻塞
 *
 * 支持两种连接模式：
 * - browser_direct: 浏览器直连 Gateway，检查 connected 状态
 * - server_proxy: 服务端代理模式，检查 serverProxyConnected 状态
 *
 * 连接确认后会自动触发数据加载（如果尚未加载）
 */
export default function GatewayRequired({
  children,
  feature = 'Gateway 功能',
}: {
  children?: React.ReactNode;
  feature?: string;
}) {
  const connected = useGatewayStore((s) => s.connected);
  const connectionMode = useGatewayStore((s) => s.connectionMode);
  const serverProxyConnected = useGatewayStore((s) => s.serverProxyConnected);
  const agentsList = useGatewayStore((s) => s.agentsList);

  // 连接成功且数据未加载时，触发数据加载
  useEffect(() => {
    const isServerProxyConnected = connectionMode === 'server_proxy' && serverProxyConnected;
    const isBrowserDirectConnected = connectionMode === 'browser_direct' && connected;
    if (!isServerProxyConnected && !isBrowserDirectConnected) return;
    // 数据已加载则跳过
    if (agentsList.length > 0) return;
    const gwStore = useGatewayStore.getState();
    Promise.allSettled([
      gwStore.refreshAgents(),
      gwStore.refreshHealth(),
      gwStore.refreshCronJobs(),
      gwStore.refreshSessions(),
      gwStore.refreshSkills(),
      gwStore.loadConfig(),
    ]).catch(() => {});
  }, [connectionMode, serverProxyConnected, connected, agentsList.length]);

  // 根据连接模式判断是否已连接
  const isConnected = connectionMode === 'server_proxy'
    ? serverProxyConnected
    : connected;

  if (isConnected) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <WifiOff className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
        未连接 Gateway
      </h3>
      <p className="text-sm mb-4 max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
        {feature}需要连接 OpenClaw Gateway 后使用
      </p>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn btn-sm btn-primary">
          前往工作台连接
        </Link>
        <Link href="/settings" className="btn btn-sm btn-secondary flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" /> 设置
        </Link>
      </div>
    </div>
  );
}
