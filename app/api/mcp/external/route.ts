/**
 * 外部 MCP API 端点 - 供 AI 成员直接调用
 * 
 * 鉴权方式：Bearer Token（member 的 openclawApiToken）
 * 支持单个或批量工具调用
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TEAMCLAW_TOOLS, type ComindToolName } from '@/core/mcp/definitions';
import { TOOL_HANDLERS, MEMBER_SCOPED_TOOLS, TEAMCLAW_VERSION } from '../handlers/tool-registry';
import { decryptToken } from '@/lib/security';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logMcpCall } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

// Token → memberId 内存缓存（避免每次请求全表扫描+解密）
const tokenCache = new Map<string, { memberId: string; mode: string; cachedAt: number }>();
const TOKEN_CACHE_TTL = 60_000; // 60 秒缓存有效期

async function authenticateMember(request: NextRequest): Promise<{ memberId: string; rawToken: string; error?: never } | { memberId?: never; rawToken?: never; error: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing Authorization header, format: Bearer <member_api_token>' };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: 'Token cannot be empty' };
  }

  // 先查缓存（避免全表扫描+逐行解密）
  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL) {
    if (cached.mode === 'chat_only') {
      return { error: 'Member execution mode does not allow direct API calls. Please switch to api_first or api_only' };
    }
    return { memberId: cached.memberId, rawToken: token };
  }

  // 缓存未命中，查数据库
  const allMembers = await db.select().from(members).where(eq(members.type, 'ai'));
  
  const member = allMembers.find(m => {
    const storedToken = m.openclawApiToken;
    if (!storedToken) return false;
    // 仅比较解密后的值（修复：之前密文也能通过鉴权）
    const decryptedToken = decryptToken(storedToken);
    return decryptedToken === token;
  });

  if (!member) {
    return { error: 'Invalid API Token' };
  }

  const mode = member.executionMode || 'chat_only';
  
  // 写入缓存
  tokenCache.set(token, { memberId: member.id, mode, cachedAt: Date.now() });

  if (mode === 'chat_only') {
    return { error: 'Member execution mode does not allow direct API calls. Please switch to api_first or api_only' };
  }

  return { memberId: member.id, rawToken: token };
}

async function executeTool(
  tool: string,
  parameters: Record<string, unknown>,
  memberId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!Object.keys(TEAMCLAW_TOOLS).includes(tool)) {
    return { success: false, error: `Unknown tool: ${tool}` };
  }

  // 自动注入 member_id
  if (MEMBER_SCOPED_TOOLS.includes(tool) && !parameters.member_id) {
    parameters.member_id = memberId;
  }

  const handler = TOOL_HANDLERS[tool as ComindToolName];
  if (!handler) {
    return { success: false, error: `Tool ${tool} is not implemented` };
  }
  return handler(parameters);
}

async function handlePost(request: NextRequest) {
  try {
    const auth = await authenticateMember(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const memberId = auth.memberId as string;
    const rawToken = auth.rawToken as string;
    const requestId = request.headers.get('x-request-id') || undefined;
    const body = await request.json();

    // 请求体大小检查
    const bodySize = JSON.stringify(body).length;
    if (bodySize > 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Request body too large' }, { status: 413 });
    }

    if (body.batch && Array.isArray(body.batch)) {
      if (body.batch.length > 50) {
        return NextResponse.json({ success: false, error: 'Batch size exceeds limit (max 50)' }, { status: 400 });
      }
      
      const results = [];
      for (const call of body.batch) {
        if (!call.tool) {
          results.push({ success: false, error: 'Missing tool field' });
          continue;
        }
        const startTime = Date.now();
        const result = await executeTool(call.tool, call.parameters || {}, memberId);
        const durationMs = Date.now() - startTime;
        logMcpCall({
          source: 'mcp_external',
          action: call.tool,
          params: call.parameters,
          success: result.success,
          result: result.success ? JSON.stringify(result.data).slice(0, 500) : undefined,
          error: result.success ? undefined : result.error,
          memberId,
          apiToken: rawToken,
          requestId,
          durationMs,
        });
        results.push({ tool: call.tool, ...result });
      }
      return NextResponse.json({ success: true, results, member_id: memberId });
    }

    const { tool, parameters } = body as { tool: string; parameters: Record<string, unknown> };
    if (!tool) {
      return NextResponse.json({ success: false, error: 'Missing tool field' }, { status: 400 });
    }

    const startTime = Date.now();
    const result = await executeTool(tool, parameters || {}, memberId);
    const durationMs = Date.now() - startTime;
    
    logMcpCall({
      source: 'mcp_external',
      action: tool,
      params: parameters,
      success: result.success,
      result: result.success ? JSON.stringify(result.data).slice(0, 500) : undefined,
      error: result.success ? undefined : result.error,
      memberId,
      apiToken: rawToken,
      requestId,
      durationMs,
    });
    
    return NextResponse.json({ ...result, member_id: memberId });
  } catch (error) {
    console.error('[TeamClaw-v3] POST /api/mcp/external error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

// 应用限流
export const POST = withRateLimit(handlePost, RATE_LIMITS.STANDARD);

export async function GET() {
  return NextResponse.json({
    version: TEAMCLAW_VERSION,
    name: 'teamclaw-mcp-tools',
    description: 'Comind MCP 外部调用接口 - 供 AI 成员直接调用',
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <member_openclaw_api_token>',
      note: '使用 AI 成员的 openclawApiToken 作为鉴权凭证。成员 executionMode 需为 api_first 或 api_only',
    },
    endpoints: {
      single: {
        method: 'POST',
        body: '{ "tool": "工具名", "parameters": { ... } }',
      },
      batch: {
        method: 'POST',
        body: '{ "batch": [{ "tool": "工具名", "parameters": { ... } }, ...] }',
      },
    },
    tools: Object.entries(TEAMCLAW_TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      parameters: def.parameters,
    })),
  });
}
