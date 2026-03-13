/**
 * Chat MCP API - 对话信道的 MCP 调用入口
 * 
 * 自动使用 Agent Token 认证，无需手动传递 Token
 * 
 * POST /api/chat-mcp
 * Body: { memberId, tool, parameters }
 * 
 * 自动注入 Agent Token，然后调用 /api/mcp/external
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateAgentToken } from '@/lib/agent-token';
import { logMcpCall } from '@/lib/audit-log';
import { TEAMCLAW_TOOLS } from '@/core/mcp/definitions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, tool, parameters } = body as {
      memberId: string;
      tool: string;
      parameters?: Record<string, unknown>;
    };

    // 参数验证
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'Missing memberId' },
        { status: 400 }
      );
    }

    if (!tool) {
      return NextResponse.json(
        { success: false, error: 'Missing tool' },
        { status: 400 }
      );
    }

    // 检查工具是否存在
    if (!Object.keys(TEAMCLAW_TOOLS).includes(tool)) {
      return NextResponse.json(
        { success: false, error: `Unknown tool: ${tool}` },
        { status: 400 }
      );
    }

    // 获取或创建 Agent Token
    const tokenInfo = await getOrCreateAgentToken(memberId);
    if (!tokenInfo) {
      return NextResponse.json(
        { success: false, error: 'Failed to get Agent Token. Member may not be an AI.' },
        { status: 403 }
      );
    }

    // 调用 MCP external API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const startTime = Date.now();

    const res = await fetch(`${baseUrl}/api/mcp/external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenInfo.token}`,
      },
      body: JSON.stringify({ tool, parameters: parameters || {} }),
    });

    const data = await res.json();
    const durationMs = Date.now() - startTime;

    // 审计日志
    logMcpCall({
      source: 'chat_channel',
      memberId,
      action: tool,
      params: parameters,
      success: data.success,
      result: data.success ? JSON.stringify(data.data).slice(0, 500) : undefined,
      error: data.success ? undefined : data.error,
      durationMs,
    });

    // 返回结果
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[chat-mcp] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET: 返回 API 说明
 */
export async function GET() {
  return NextResponse.json({
    name: 'Chat MCP API',
    description: '对话信道的 MCP 调用入口，自动使用 Agent Token 认证',
    usage: {
      method: 'POST',
      body: {
        memberId: 'AI 成员 ID（必填）',
        tool: 'MCP 工具名称',
        parameters: '工具参数',
      },
    },
    tools: Object.keys(TEAMCLAW_TOOLS).length,
    hint: 'Agent Token 会自动创建和注入，无需手动管理',
  });
}
