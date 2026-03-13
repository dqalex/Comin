/**
 * MCP API Route - 工具调用入口（内部）
 * 
 * POST /api/mcp - 执行工具调用
 * GET  /api/mcp - 获取可用工具列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { TEAMCLAW_TOOLS, type ComindToolName } from '@/core/mcp/definitions';
import { TOOL_HANDLERS, TEAMCLAW_VERSION } from './handlers/tool-registry';
import { logMcpCall } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body as { tool: string; parameters: Record<string, unknown> };
    
    if (!Object.keys(TEAMCLAW_TOOLS).includes(tool)) {
      return NextResponse.json(
        { success: false, error: `Unknown tool: ${tool}` },
        { status: 400 }
      );
    }

    const handler = TOOL_HANDLERS[tool as ComindToolName];
    if (!handler) {
      return NextResponse.json(
        { success: false, error: `Tool ${tool} not implemented` },
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
    logMcpCall({
      source: 'mcp',
      action: tool,
      params: parameters,
      success: result.success,
      result: result.success ? JSON.stringify(result.data).slice(0, 500) : undefined,
      error: result.success ? undefined : result.error,
      requestId,
      agentId,
      sessionKey,
      durationMs,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[TeamClaw-v3] POST /api/mcp error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      version: TEAMCLAW_VERSION,
      name: 'teamclaw-mcp-tools',
      description: 'TeamClaw MCP Tools - AI Agent Team Collaboration Platform',
      tools: Object.entries(TEAMCLAW_TOOLS).map(([name, def]) => ({
        name,
        description: def.description,
        parameters: def.parameters,
      })),
    });
  } catch (error) {
    console.error('[TeamClaw-v3] GET /api/mcp error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get tool list' },
      { status: 500 }
    );
  }
}
