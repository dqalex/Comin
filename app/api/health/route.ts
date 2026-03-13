/**
 * GET /api/health - 服务健康检查
 * 
 * 简单的健康检查端点，用于：
 * - 负载均衡器健康探测
 * - 服务可用性监控
 * - 测试框架连接验证
 * 
 * 无需认证，返回服务状态。
 */

import { NextResponse } from 'next/server';
import { sqlite } from '@/db';
import { APP_VERSION } from '@/lib/version';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  
  try {
    // 基础健康检查：验证数据库连接
    let dbStatus = 'ok';
    let dbError: string | null = null;
    
    try {
      // 执行简单查询验证数据库连接
      sqlite.prepare('SELECT 1').get();
    } catch (e) {
      dbStatus = 'error';
      dbError = e instanceof Error ? e.message : 'Database connection failed';
    }
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: dbStatus === 'ok' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor(process.uptime()),
      responseTime,
      checks: {
        database: {
          status: dbStatus,
          ...(dbError && { error: dbError }),
        },
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    }, { status: 503 });
  }
}
