/**
 * 成员解析器 - 共享能力模块
 * 
 * 提取 MCP handler 中共用的 "查找默认 AI/人类成员" 逻辑
 */

import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 解析目标 AI 成员 ID
 * 如果 memberId 已提供则直接返回，否则查找第一个 AI 成员
 */
export async function resolveAIMemberId(memberId?: string | null): Promise<{ memberId: string } | { error: string }> {
  if (memberId) return { memberId };
  
  const [aiMember] = await db.select().from(members).where(eq(members.type, 'ai'));
  if (!aiMember) {
    return { error: '未找到 AI 成员' };
  }
  return { memberId: aiMember.id };
}

/**
 * 解析目标人类成员 ID
 * 如果 memberId 已提供则直接返回，否则查找第一个人类成员
 */
export async function resolveHumanMemberId(memberId?: string | null): Promise<{ memberId: string | null }> {
  if (memberId) return { memberId };
  
  const [humanMember] = await db.select().from(members).where(eq(members.type, 'human'));
  return { memberId: humanMember?.id || null };
}
