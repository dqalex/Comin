/**
 * Next.js Instrumentation Hook
 * 
 * 在服务启动时执行，用于初始化：
 * 1. 服务端 Gateway 连接（server_proxy 模式）
 * 2. 定时全量同步调度器（auto-sync scheduler）
 * 3. 心跳 + 文件监听
 */

export async function register() {
  // 仅在服务端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');
    
    // 1. 初始化 Gateway 连接
    try {
      const { initServerGatewayClient } = await import('./lib/server-gateway-client');
      
      initServerGatewayClient()
        .then((client) => {
          if (client) {
            console.log('[Instrumentation] Gateway client initialized successfully');
          } else {
            console.log('[Instrumentation] No Gateway config found, skipping connection');
          }
        })
        .catch((err) => {
          console.error('[Instrumentation] Gateway initialization failed:', err.message);
        });
    } catch (err) {
      console.error('[Instrumentation] Failed to load server-gateway-client:', err);
    }

    // 2. 延迟启动定时同步和心跳（等待服务完全就绪）
    setTimeout(async () => {
      try {
        const { startAllAutoSync } = await import('./lib/openclaw/auto-sync-scheduler');
        const count = await startAllAutoSync();
        console.log(`[Instrumentation] Auto-sync schedulers started: ${count} workspace(s)`);
      } catch (err) {
        console.error('[Instrumentation] Failed to start auto-sync schedulers:', err);
      }

      try {
        const { startAllHeartbeats } = await import('./lib/openclaw/index-manager');
        const count = await startAllHeartbeats();
        console.log(`[Instrumentation] Heartbeats started: ${count} workspace(s)`);
      } catch (err) {
        console.error('[Instrumentation] Failed to start heartbeats:', err);
      }
    }, 3000); // 3 秒后启动，确保数据库连接已就绪
  }
}
