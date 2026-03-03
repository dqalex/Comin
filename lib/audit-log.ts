/**
 * 审计日志服务
 * 
 * 记录所有 MCP 调用、对话信道命令、Gateway 事件，
 * 方便排查问题和追踪 AI 成员行为。
 */

import { db, auditLogs } from '@/db';
import { generateId } from '@/lib/id';
import { createHash } from 'crypto';
import { desc, eq, and, gte, lte, like } from 'drizzle-orm';

// 日志来源类型
export type AuditSource = 'mcp' | 'mcp_external' | 'chat_channel' | 'gateway' | 'system';

// 写入参数
export interface AuditLogEntry {
  source: AuditSource;
  action: string;
  params?: Record<string, unknown>;
  success: boolean;
  result?: string;
  error?: string;
  // 调用者身份（可选，能提供多少就提供多少）
  memberId?: string;
  agentId?: string;
  gatewayUrl?: string;
  apiToken?: string;        // 原始 token，会被哈希后存储
  sessionKey?: string;
  requestId?: string;
  durationMs?: number;
}

// 查询过滤条件
export interface AuditLogFilter {
  source?: AuditSource;
  memberId?: string;
  agentId?: string;
  action?: string;
  success?: boolean;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

/**
 * 对 API Token 做 SHA-256 哈希（脱敏存储，仅用于匹配）
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/**
 * 对参数进行脱敏处理
 * 移除敏感字段（token、password、secret 等）
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['api_token', 'token', 'password', 'secret', 'key', 'encrypted_token', 'openclawApiToken'];
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (sensitiveKeys.includes(k.toLowerCase())) {
      sanitized[k] = v ? '[REDACTED]' : null;
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeParams(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/**
 * 写入审计日志（异步，不抛异常）
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const now = new Date();
    await db.insert(auditLogs).values({
      id: generateId(),
      source: entry.source,
      memberId: entry.memberId || null,
      agentId: entry.agentId || null,
      gatewayUrl: entry.gatewayUrl || null,
      apiToken: entry.apiToken ? hashToken(entry.apiToken) : null,
      action: entry.action,
      params: entry.params ? sanitizeParams(entry.params) : null,
      success: entry.success,
      result: entry.result ? entry.result.slice(0, 1000) : null,  // 截断结果
      error: entry.error ? entry.error.slice(0, 1000) : null,
      sessionKey: entry.sessionKey || null,
      requestId: entry.requestId || null,
      durationMs: entry.durationMs || null,
      createdAt: now,
    });
  } catch (e) {
    // 审计日志写入失败不应影响业务
    console.error('[AuditLog] 写入失败:', e);
  }
}

/**
 * 便捷方法：记录 MCP 调用
 */
export async function logMcpCall(
  action: string,
  params: Record<string, unknown>,
  result: { success: boolean; data?: unknown; error?: string },
  options: {
    source?: 'mcp' | 'mcp_external';
    memberId?: string;
    apiToken?: string;
    agentId?: string;
    sessionKey?: string;
    requestId?: string;
    durationMs?: number;
  } = {}
): Promise<void> {
  await writeAuditLog({
    source: options.source || 'mcp',
    action,
    params,
    success: result.success,
    result: result.data ? JSON.stringify(result.data).slice(0, 500) : undefined,
    error: result.error,
    memberId: options.memberId,
    agentId: options.agentId,
    sessionKey: options.sessionKey,
    apiToken: options.apiToken,
    requestId: options.requestId,
    durationMs: options.durationMs,
  });
}

/**
 * 便捷方法：记录对话信道命令
 */
export async function logChatChannelCommand(
  action: string,
  params: Record<string, unknown>,
  result: { success: boolean; message?: string; error?: string },
  options: {
    agentId?: string;
    gatewayUrl?: string;
    sessionKey?: string;
    memberId?: string;
  } = {}
): Promise<void> {
  await writeAuditLog({
    source: 'chat_channel',
    action,
    params,
    success: result.success,
    result: result.message,
    error: result.error,
    agentId: options.agentId,
    gatewayUrl: options.gatewayUrl,
    sessionKey: options.sessionKey,
    memberId: options.memberId,
  });
}

/**
 * 查询审计日志
 */
export async function queryAuditLogs(filter: AuditLogFilter = {}): Promise<{
  logs: (typeof auditLogs.$inferSelect)[];
  total: number;
}> {
  const conditions = [];
  
  if (filter.source) conditions.push(eq(auditLogs.source, filter.source));
  if (filter.memberId) conditions.push(eq(auditLogs.memberId, filter.memberId));
  if (filter.agentId) conditions.push(eq(auditLogs.agentId, filter.agentId));
  if (filter.action) conditions.push(like(auditLogs.action, `%${filter.action}%`));
  if (filter.success !== undefined) conditions.push(eq(auditLogs.success, filter.success));
  if (filter.startTime) conditions.push(gte(auditLogs.createdAt, filter.startTime));
  if (filter.endTime) conditions.push(lte(auditLogs.createdAt, filter.endTime));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const limit = Math.min(filter.limit || 50, 200);
  const offset = filter.offset || 0;

  const [logs, countResult] = await Promise.all([
    db.select().from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: auditLogs.id }).from(auditLogs)
      .where(whereClause),
  ]);

  return {
    logs,
    total: countResult.length,
  };
}

/**
 * 通过 token 哈希查找关联的成员
 */
export async function findMemberByTokenHash(tokenHash: string): Promise<(typeof auditLogs.$inferSelect)[]> {
  return db.select().from(auditLogs)
    .where(eq(auditLogs.apiToken, tokenHash))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);
}
