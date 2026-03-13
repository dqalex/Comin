/**
 * 审计日志系统
 * 
 * 记录 MCP 调用和敏感操作，便于安全事件追踪和合规审计
 * 
 * 日志来源：
 * - mcp: 内部 MCP 调用
 * - mcp_external: 外部 MCP 调用（通过 Bearer Token）
 * - chat_channel: 对话信道自动执行
 * - gateway: Gateway 事件
 * - system: 系统操作
 */

import { db } from '@/db';
import { auditLogs, AuditLog, NewAuditLog } from '@/db/schema';
import { generateId } from './id';
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm';

// ============================================================
// 类型定义（与 schema 保持一致）
// ============================================================

export type AuditSource = 'mcp' | 'mcp_external' | 'chat_channel' | 'gateway' | 'system';

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

export interface AuditLogEntry {
  source: AuditSource;
  memberId?: string | null;
  agentId?: string | null;
  gatewayUrl?: string | null;
  apiToken?: string | null;
  action: string;
  params?: Record<string, unknown> | null;
  success: boolean;
  result?: string | null;
  error?: string | null;
  sessionKey?: string | null;
  requestId?: string | null;
  durationMs?: number | null;
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 记录审计日志
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: generateId(),
      source: entry.source,
      memberId: entry.memberId ?? null,
      agentId: entry.agentId ?? null,
      gatewayUrl: entry.gatewayUrl ?? null,
      apiToken: entry.apiToken ? hashToken(entry.apiToken) : null,
      action: entry.action,
      params: entry.params ?? null,
      success: entry.success,
      result: entry.result ?? null,
      error: entry.error ?? null,
      sessionKey: entry.sessionKey ?? null,
      requestId: entry.requestId ?? null,
      durationMs: entry.durationMs ?? null,
      createdAt: new Date(),
    } satisfies NewAuditLog);
  } catch (error) {
    // 审计日志失败不应影响主流程
    console.error('[AuditLog] Failed to write audit log:', error);
  }
}

/**
 * 查询审计日志（带分页）
 */
export async function queryAuditLogs(filter: AuditLogFilter): Promise<{
  logs: AuditLog[];
  total: number;
}> {
  const conditions = [];
  
  if (filter.source) {
    conditions.push(eq(auditLogs.source, filter.source));
  }
  if (filter.memberId) {
    conditions.push(eq(auditLogs.memberId, filter.memberId));
  }
  if (filter.agentId) {
    conditions.push(eq(auditLogs.agentId, filter.agentId));
  }
  if (filter.action) {
    conditions.push(sql`${auditLogs.action} LIKE ${`%${filter.action}%`}`);
  }
  if (filter.success !== undefined) {
    conditions.push(eq(auditLogs.success, filter.success));
  }
  if (filter.startTime) {
    conditions.push(gte(auditLogs.createdAt, filter.startTime));
  }
  if (filter.endTime) {
    conditions.push(lte(auditLogs.createdAt, filter.endTime));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  // 查询总数
  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(whereClause);

  // 查询日志
  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return { logs, total };
}

/**
 * 记录 MCP 调用（便捷函数）
 */
export async function logMcpCall(params: {
  source: AuditSource;
  action: string;
  params?: Record<string, unknown>;
  success: boolean;
  result?: string;
  error?: string;
  memberId?: string;
  agentId?: string;
  gatewayUrl?: string;
  apiToken?: string;
  sessionKey?: string;
  requestId?: string;
  durationMs?: number;
}): Promise<void> {
  await logAudit({
    source: params.source,
    action: params.action,
    params: params.params,
    success: params.success,
    result: params.result,
    error: params.error,
    memberId: params.memberId,
    agentId: params.agentId,
    gatewayUrl: params.gatewayUrl,
    apiToken: params.apiToken,
    sessionKey: params.sessionKey,
    requestId: params.requestId,
    durationMs: params.durationMs,
  });
}

/**
 * 获取最近的审计日志
 */
export async function getRecentLogs(limit = 50): Promise<AuditLog[]> {
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * 获取失败的操作日志
 */
export async function getFailedLogs(hours = 24, limit = 100): Promise<AuditLog[]> {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return db
    .select()
    .from(auditLogs)
    .where(and(
      eq(auditLogs.success, false),
      gte(auditLogs.createdAt, startTime)
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 对 Token 进行简单哈希（用于脱敏匹配）
 */
function hashToken(token: string): string {
  // 简单的哈希：取前 8 位 + 后 4 位
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

// ============================================================
// 类型导出
// ============================================================

export type { AuditLog, NewAuditLog };
