/**
 * MCP API Route - 工具调用入口（内部）
 * 
 * POST /api/mcp - 执行工具调用
 * GET  /api/mcp - 获取可用工具列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { COMIND_TOOLS, type ComindToolName } from '@/core/mcp/definitions';
import { TOOL_HANDLERS, COMIND_VERSION } from './handlers/tool-registry';
import { logMcpCall } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body as { tool: string; parameters: Record<string, unknown> };
    
    if (!Object.keys(COMIND_TOOLS).includes(tool)) {
      return NextResponse.json(
        { success: false, error: `未知工具: ${tool}` },
        { status: 400 }
      );
    }
    
    const handler = TOOL_HANDLERS[tool as ComindToolName];
    if (!handler) {
      return NextResponse.json(
        { success: false, error: `工具 ${tool} 暂未实现` },
        { status: 400 }
      );
    }
    
    const startTime = Date.now();
    const result = await handler(parameters || {});
    const durationMs = Date.now() - startTime;
    
    // 审计日志（异步，不阻塞响应）
    const requestId = request.headers.get('x-request-id') || undefined;
    const agentId = request.headers.get('x-agent-id') || undefined;
    const sessionKey = request.headers.get('x-session-key') || undefined;
    logMcpCall(tool, parameters || {}, result, {
      source: 'mcp',
      requestId,
      agentId,
      sessionKey,
      durationMs,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CoMind-v2] POST /api/mcp error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      version: COMIND_VERSION,
      name: 'comind-mcp-tools',
      description: 'CoMind MCP 工具集 - AI Agent 团队协作平台',
      tools: Object.entries(COMIND_TOOLS).map(([name, def]) => ({
        name,
        description: def.description,
        parameters: def.parameters,
      })),
    });
  } catch (error) {
    console.error('[CoMind-v2] GET /api/mcp error:', error);
    return NextResponse.json(
      { success: false, error: '获取工具列表失败' },
      { status: 500 }
    );
  }
}
