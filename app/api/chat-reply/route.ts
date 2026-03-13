/**
 * Chat AI 回复 API
 * 根据成员的 deployMode 路由到 Knot 或 OpenClaw 后端
 */
import { NextRequest, NextResponse } from 'next/server';
import { db, members } from '@/db';
import { eq } from 'drizzle-orm';
import { ssrfCheck, type SSRFConfig } from '@/lib/security';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

const KNOT_API_BASE = process.env.KNOT_API_BASE || '';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

interface ChatReplyRequest {
  memberId: string;
  message: string;
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
}

/** 从请求头或环境变量获取 SSRF 配置 */
function getSsrfConfig(request: NextRequest): SSRFConfig {
  // 从 cookie 读取用户设置
  const ssrfConfigCookie = request.cookies.get('teamclaw-ssrf-config');
  if (ssrfConfigCookie) {
    try {
      const config = JSON.parse(decodeURIComponent(ssrfConfigCookie.value));
      return {
        allowExternalAccess: !!config.allowExternalAccess,
        enableDnsRebindingProtection: config.enableDnsRebindingProtection !== false,
      };
    } catch { /* malformed SSRF cookie, use defaults */ }
  }
  
  // 默认：仅本地访问
  return {
    allowExternalAccess: false,
    enableDnsRebindingProtection: true,
  };
}

async function handlePost(request: NextRequest) {
  try {
    const body: ChatReplyRequest = await request.json();
    const { memberId, message, conversationId, history } = body;

    // 输入验证
    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'Invalid memberId format' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(memberId)) {
      return NextResponse.json({ error: 'Invalid memberId format' }, { status: 400 });
    }
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    const sanitizedMessage = message.slice(0, 50000);
    if (!sanitizedMessage.trim()) {
      return NextResponse.json({ error: 'message cannot be empty' }, { status: 400 });
    }

    // 从数据库读取成员配置
    const [member] = await db.select().from(members).where(eq(members.id, memberId));
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (member.type !== 'ai') {
      return NextResponse.json({ error: 'Member is not an AI' }, { status: 400 });
    }

    const deployMode = member.openclawDeployMode || 'knot';

    // 根据部署模式路由
    if (deployMode === 'knot') {
      return handleKnotReply(member, sanitizedMessage, conversationId);
    }
    return handleOpenClawReply(member, sanitizedMessage, history, request);
  } catch (error) {
    console.error('[chat-reply]', error);
    // 不暴露内部错误详情
    return NextResponse.json({ error: 'Request processing failed' }, { status: 500 });
  }
}

// 应用限流
export const POST = withRateLimit(handlePost, RATE_LIMITS.CHAT);

/**
 * Knot 平台 AI 回复（AG-UI 协议）
 */
async function handleKnotReply(
  member: Record<string, unknown>,
  message: string,
  conversationId?: string,
) {
  const agentId = member.openclawAgentId as string;
  const rawToken = member.openclawApiToken as string;
  const apiToken = rawToken || '';
  const model = (member.openclawModel as string) || 'deepseek-v3.1';
  const enableWebSearch = !!member.openclawEnableWebSearch;
  const temperature = (member.openclawTemperature as number) || 0.5;

  if (!agentId || !apiToken) {
    return NextResponse.json(
      { error: 'AI member is missing Agent ID or API Token configuration' },
      { status: 400 },
    );
  }

  const url = `${KNOT_API_BASE}/agui/${agentId}`;
  const requestBody = {
    input: {
      message,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      model,
      stream: true,
      enable_web_search: enableWebSearch,
      temperature,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-knot-api-token': apiToken.trim(),
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[chat-reply:knot]', response.status, errorText);
    let errorMessage = 'Knot service request failed';
    if (response.status === 401) {
      errorMessage = 'Knot API Token is invalid or expired';
    } else if (response.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later';
    } else if (response.status >= 500) {
      errorMessage = 'Knot service is temporarily unavailable';
    }
    return NextResponse.json({ error: errorMessage }, { status: response.status });
  }

  // 解析 SSE 流或 JSON
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  // JSON 响应
  if (contentType.includes('application/json') || (!text.includes('data:') && text.startsWith('{'))) {
    try {
      const json = JSON.parse(text);
      if (json.code && json.code !== 0) {
        return NextResponse.json({ error: json.msg || `Knot error (code: ${json.code})` }, { status: 401 });
      }
      const content = json.content || json.message || json.answer || json.reply || json.data?.content || '';
      const convId = json.conversation_id || json.conversationId || json.data?.conversation_id || '';
      return NextResponse.json({ success: true, content: String(content), conversationId: convId });
    } catch { /* fallthrough to SSE parse */ }
  }

  // SSE 流解析
  const result: string[] = [];
  let responseConversationId = '';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const dataStr = trimmed.slice(5).trim();
    if (dataStr === '[DONE]') break;
    try {
      const msg = JSON.parse(dataStr);
      if (msg.rawEvent?.conversation_id) responseConversationId = msg.rawEvent.conversation_id;
      if (msg.conversation_id) responseConversationId = msg.conversation_id;
      const isTextContent =
        msg.type === 'TEXT_MESSAGE_CONTENT' || msg.type === 'TextMessageContent' || msg.type === 'text_message_content';
      if (isTextContent) {
        const chunk = msg.rawEvent?.content || msg.content || msg.data?.content || msg.delta?.content || '';
        if (chunk) result.push(chunk);
      }
      if ((msg.type === 'TEXT_MESSAGE_END' || msg.type === 'TextMessageEnd') && result.length === 0) {
        const full = msg.rawEvent?.content || msg.content || '';
        if (full) result.push(full);
      }
      if ((msg.type === 'RUN_FINISHED' || msg.type === 'RunFinished') && result.length === 0) {
        const final = msg.rawEvent?.content || msg.content || msg.rawEvent?.output || '';
        if (final) result.push(final);
      }
      if (msg.choices?.[0]?.delta?.content) result.push(msg.choices[0].delta.content);
      if (msg.choices?.[0]?.message?.content && result.length === 0) result.push(msg.choices[0].message.content);
    } catch { /* ignore single line parse error */ }
  }

  return NextResponse.json({
    success: true,
    content: result.join('') || '',
    conversationId: responseConversationId,
  });
}

/**
 * OpenClaw 本地 AI 回复（OpenAI 兼容协议）
 * 使用增强的 SSRF 防护
 */
async function handleOpenClawReply(
  member: Record<string, unknown>,
  message: string,
  history: Array<{ role: string; content: string }> | undefined,
  request: NextRequest,
) {
  const endpoint = (member.openclawEndpoint as string) || process.env.OPENCLAW_DEFAULT_ENDPOINT || 'http://127.0.0.1:18789';
  const base = endpoint.replace(/\/+$/, '');

  // 获取 SSRF 配置
  const ssrfConfig = getSsrfConfig(request);

  // 增强的 SSRF 防护检查（包含 DNS 重绑定防护）
  const ssrfResult = await ssrfCheck(base, ssrfConfig);
  if (!ssrfResult.allowed) {
    console.warn('[chat-reply:ssrf] Blocked:', base, ssrfResult.error);
    return NextResponse.json(
      { error: ssrfResult.error || 'Endpoint address not allowed' },
      { status: 400 }
    );
  }

  // 验证并清理历史消息
  const sanitizedHistory = (history || [])
    .filter((h): h is { role: string; content: string } => 
      typeof h.role === 'string' && typeof h.content === 'string'
    )
    .map(h => ({
      role: h.role.slice(0, 20) || 'user',
      content: h.content.slice(0, 50000) || ''
    }))
    .slice(-20); // 限制历史消息数量

  const messages = [
    ...sanitizedHistory,
    { role: 'user', content: message },
  ];

  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
    },
    body: JSON.stringify({ model: 'openclaw:main', messages, stream: false }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[chat-reply:openclaw]', response.status, errorText);
    let errorMessage = 'OpenClaw service request failed';
    if (response.status === 401) {
      errorMessage = 'OpenClaw Token is invalid';
    } else if (response.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later';
    } else if (response.status >= 500) {
      errorMessage = 'OpenClaw service is temporarily unavailable';
    }
    return NextResponse.json({ error: errorMessage }, { status: response.status });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return NextResponse.json({ success: true, content });
}
