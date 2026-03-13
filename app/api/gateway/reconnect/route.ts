/**
 * Gateway 重连 API
 * 
 * POST - 触发 Gateway 重新连接（服务端代理模式）
 */

import { NextResponse } from 'next/server';
import {
  getGatewayConfig,
  initServerGatewayClient,
  getServerGatewayClient,
} from '@/lib/server-gateway-client';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const config = await getGatewayConfig();
    
    if (!config) {
      return NextResponse.json(
        { data: null, error: 'No gateway config found' },
        { status: 404 }
      );
    }

    if (config.mode !== 'server_proxy') {
      return NextResponse.json(
        { data: null, error: 'Reconnect only available in server_proxy mode' },
        { status: 400 }
      );
    }

    // 检查当前连接状态
    const client = getServerGatewayClient();
    if (client.isConnected) {
      return NextResponse.json({
        data: { status: 'connected', message: 'Already connected' },
        error: null,
      });
    }

    // 尝试连接
    try {
      await initServerGatewayClient();
      return NextResponse.json({
        data: { status: 'connected', message: 'Connected successfully' },
        error: null,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Connection failed';
      return NextResponse.json(
        { data: { status: 'error', message: error }, error },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error('[API] Gateway reconnect error:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to reconnect' },
      { status: 500 }
    );
  }
}
