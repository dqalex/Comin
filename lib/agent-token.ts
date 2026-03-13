/**
 * Agent MCP Token 服务
 * 
 * 提供：
 * 1. 根据 Member ID 获取 Token
 * 2. Token 验证
 * 3. Token 自动创建
 */

import { db, agentMcpTokens, members } from '@/db';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { encryptToken, decryptToken } from '@/lib/security';
import { createHash, randomBytes } from 'crypto';

const AGENT_TOKEN_PREFIX = 'cma_';

function generateAgentMcpToken(): string {
  return `${AGENT_TOKEN_PREFIX}${generateId()}${generateId()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AgentTokenInfo {
  token: string;
  memberId: string;
  memberName: string;
  agentId?: string | null;
}

/**
 * 获取或创建 Agent 的 MCP Token
 * 
 * @param memberId AI 成员 ID
 * @returns Token 信息（包含明文 Token）
 */
export async function getOrCreateAgentToken(memberId: string): Promise<AgentTokenInfo | null> {
  // 查找成员
  const [member] = await db.select().from(members).where(eq(members.id, memberId));
  if (!member || member.type !== 'ai') {
    return null;
  }

  const now = new Date();

  // 查找已有 Token
  const [existingToken] = await db.select()
    .from(agentMcpTokens)
    .where(and(
      eq(agentMcpTokens.memberId, member.id),
      eq(agentMcpTokens.status, 'active')
    ))
    .limit(1);

  if (existingToken) {
    // 更新使用时间
    await db.update(agentMcpTokens)
      .set({
        lastUsedAt: now,
        usageCount: (existingToken.usageCount || 0) + 1,
        updatedAt: now,
      })
      .where(eq(agentMcpTokens.id, existingToken.id));

    return {
      token: decryptToken(existingToken.encryptedToken),
      memberId: member.id,
      memberName: member.name,
      agentId: existingToken.agentId,
    };
  }

  // 创建新 Token
  const newToken = generateAgentMcpToken();
  const encryptedToken = encryptToken(newToken);

  await db.insert(agentMcpTokens).values({
    id: `amt-${generateId()}`,
    memberId: member.id,
    agentId: member.openclawAgentId || null,
    tokenHash: hashToken(newToken),
    encryptedToken,
    source: 'auto',
    status: 'active',
    lastUsedAt: now,
    usageCount: 1,
    createdAt: now,
    updatedAt: now,
  });

  return {
    token: newToken,
    memberId: member.id,
    memberName: member.name,
    agentId: member.openclawAgentId,
  };
}

/**
 * 根据 Token Hash 查找 Token 记录
 */
export async function findAgentTokenByHash(tokenHash: string): Promise<typeof agentMcpTokens.$inferSelect | null> {
  const [record] = await db.select()
    .from(agentMcpTokens)
    .where(and(
      eq(agentMcpTokens.tokenHash, tokenHash),
      eq(agentMcpTokens.status, 'active')
    ))
    .limit(1);

  return record || null;
}

/**
 * 验证 Token 并返回关联的 Member ID
 */
export async function validateAgentToken(token: string): Promise<{ memberId: string; agentId?: string | null } | null> {
  const tokenHash = hashToken(token);
  const record = await findAgentTokenByHash(tokenHash);

  if (!record) {
    return null;
  }

  // 检查是否过期
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return null;
  }

  // 更新使用时间
  await db.update(agentMcpTokens)
    .set({
      lastUsedAt: new Date(),
      usageCount: (record.usageCount || 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(agentMcpTokens.id, record.id));

  return {
    memberId: record.memberId || '',
    agentId: record.agentId || '',
  };
}

/**
 * 根据 Member ID 获取 Token（如果存在）
 */
export async function getAgentTokenByMemberId(memberId: string): Promise<string | null> {
  const [record] = await db.select()
    .from(agentMcpTokens)
    .where(and(
      eq(agentMcpTokens.memberId, memberId),
      eq(agentMcpTokens.status, 'active')
    ))
    .limit(1);

  if (!record) {
    return null;
  }

  return decryptToken(record.encryptedToken);
}
