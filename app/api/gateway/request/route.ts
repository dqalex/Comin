/**
 * Gateway 请求代理 API
 * 
 * POST - 代理请求到 Gateway
 * 
 * 用于服务端代理模式下，浏览器通过此 API 发送请求到 Gateway
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerGatewayClient, getGatewayConfig } from '@/lib/server-gateway-client';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 检查是否为服务端代理模式
    const config = await getGatewayConfig();
    
    if (!config) {
      return NextResponse.json(
        { data: null, error: 'Gateway not configured' },
        { status: 400 }
      );
    }

    if (config.mode !== 'server_proxy') {
      return NextResponse.json(
        { data: null, error: 'Not in server proxy mode. Use browser direct connection.' },
        { status: 400 }
      );
    }

    // 获取客户端
    const client = getServerGatewayClient();
    
    if (!client.isConnected) {
      return NextResponse.json(
        { data: null, error: 'Gateway not connected' },
        { status: 503 }
      );
    }

    // 解析请求
    const body = await req.json();
    
    if (!body.method) {
      return NextResponse.json(
        { data: null, error: 'method is required' },
        { status: 400 }
      );
    }

    // 发送请求到 Gateway
    const result = await client.request(body.method, body.params || {});

    return NextResponse.json({
      data: result,
      error: null,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error('[API] Gateway request error:', error);
    
    return NextResponse.json(
      { data: null, error },
      { status: 500 }
    );
  }
}
