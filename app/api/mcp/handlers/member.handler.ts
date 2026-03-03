/**
 * AI 成员自注册 Handler
 */

import { db, members } from '@/db';
import { openclawStatus, scheduledTasks, scheduledTaskHistory, deliveries, chatSessions, chatMessages, openclawWorkspaces, openclawFiles, openclawVersions, openclawConflicts } from '@/db/schema';
import { generateMemberId, generateId } from '@/lib/id';
import { eq, and, inArray } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { encryptToken, decryptToken, sanitizeString, isValidUrl } from '@/lib/security';

/**
 * 生成 MCP API Token
 * 格式: cmk_<base58随机字符串> (共约 30 字符)
 */
function generateMcpToken(): string {
  return `cmk_${generateId()}${generateId()}`;
}

type DeployMode = 'cloud' | 'local' | 'knot';
type ExecutionMode = 'chat_only' | 'api_first' | 'api_only';

export async function handleRegisterMember(params: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const name = sanitizeString(params.name, 100);
  const endpoint = sanitizeString(params.endpoint, 500);
  const deployModeRaw = sanitizeString(params.deploy_mode, 20) || 'local';
  const deployMode: DeployMode = ['cloud', 'local', 'knot'].includes(deployModeRaw) ? deployModeRaw as DeployMode : 'local';
  const executionModeRaw = sanitizeString(params.execution_mode, 20) || 'api_first';
  const executionMode: ExecutionMode = ['chat_only', 'api_first', 'api_only'].includes(executionModeRaw) ? executionModeRaw as ExecutionMode : 'api_first';
  const tools = Array.isArray(params.tools) ? (params.tools as string[]).slice(0, 50) : undefined;
  const taskTypes = Array.isArray(params.task_types) ? (params.task_types as string[]).slice(0, 50) : undefined;
  const apiToken = sanitizeString(params.api_token, 500);

  if (!name) {
    return { success: false, error: '缺少必要参数：name' };
  }
  if (!endpoint) {
    return { success: false, error: '缺少必要参数：endpoint' };
  }
  
  // 验证 endpoint URL 格式（支持 http 和 https）
  if (!isValidUrl(endpoint, ['http:', 'https:'])) {
    return { success: false, error: 'endpoint 必须是有效的 http/https URL' };
  }

  try {
    const now = new Date();

    // 去重：按 endpoint 匹配已有 AI 成员
    // 重复成员的清理由 refreshAgents（gateway.store.ts）按 (gwUrl, agentId) 统一处理
    const existing = await db.select().from(members).where(
      and(
        eq(members.type, 'ai'),
        eq(members.openclawEndpoint, endpoint),
      )
    );

    if (existing.length > 0) {
      // 如有多个 endpoint 相同的成员，保留最新的（后面覆盖前面）
      const sorted = [...existing].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt as unknown as string).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt as unknown as string).getTime() : 0;
        return timeB - timeA;
      });
      const member = sorted[0];

      // 删除旧的重复成员（带级联清理，问题 #5）
      for (let i = 1; i < sorted.length; i++) {
        const oldId = sorted[i].id;
        // 级联清理依赖数据
        const oldSchedules = await db.select({ id: scheduledTasks.id }).from(scheduledTasks).where(eq(scheduledTasks.memberId, oldId));
        const stIds = oldSchedules.map(s => s.id);
        if (stIds.length > 0) {
          await db.delete(scheduledTaskHistory).where(inArray(scheduledTaskHistory.scheduledTaskId, stIds));
        }
        await db.delete(scheduledTasks).where(eq(scheduledTasks.memberId, oldId));
        await db.delete(openclawStatus).where(eq(openclawStatus.memberId, oldId));
        await db.update(deliveries).set({ reviewerId: null }).where(eq(deliveries.reviewerId, oldId));
        await db.delete(deliveries).where(eq(deliveries.memberId, oldId));
        // 清理 chatSessions
        const oldSessions = await db.select({ id: chatSessions.id }).from(chatSessions).where(eq(chatSessions.memberId, oldId));
        const sessIds = oldSessions.map(s => s.id);
        if (sessIds.length > 0) {
          await db.delete(chatMessages).where(inArray(chatMessages.sessionId, sessIds));
          await db.delete(chatSessions).where(eq(chatSessions.memberId, oldId));
        }
        // 清理 openclawWorkspaces
        const oldWs = await db.select({ id: openclawWorkspaces.id }).from(openclawWorkspaces).where(eq(openclawWorkspaces.memberId, oldId));
        const wsIds = oldWs.map(w => w.id);
        if (wsIds.length > 0) {
          const wsFileIds = (await db.select({ id: openclawFiles.id }).from(openclawFiles).where(inArray(openclawFiles.workspaceId, wsIds))).map(f => f.id);
          if (wsFileIds.length > 0) {
            await db.delete(openclawConflicts).where(inArray(openclawConflicts.fileId, wsFileIds));
            await db.delete(openclawVersions).where(inArray(openclawVersions.fileId, wsFileIds));
            await db.delete(openclawFiles).where(inArray(openclawFiles.workspaceId, wsIds));
          }
          await db.delete(openclawWorkspaces).where(inArray(openclawWorkspaces.id, wsIds));
        }
        await db.delete(members).where(eq(members.id, oldId));
        eventBus.emit({ type: 'member_update', data: { memberId: oldId } });
      }

      const updateData: Record<string, unknown> = {
        name,
        openclawName: name,
        openclawDeployMode: deployMode,
        openclawEndpoint: endpoint,
        openclawConnectionStatus: 'connected',
        openclawLastHeartbeat: now,
        configSource: 'self',
        executionMode,
        updatedAt: now,
      };

      if (apiToken) updateData.openclawApiToken = encryptToken(apiToken);
      if (tools && Array.isArray(tools)) updateData.experienceTools = tools;
      if (taskTypes && Array.isArray(taskTypes)) updateData.experienceTaskTypes = taskTypes;

      await db.update(members).set(updateData).where(eq(members.id, member.id));
      eventBus.emit({ type: 'member_update', data: { memberId: member.id } });

      return {
        success: true,
        data: { memberId: member.id, message: `AI 成员配置已更新`, isNew: false },
      };
    }

    const newId = generateMemberId();
    const newMember = {
      id: newId,
      name,
      type: 'ai' as const,
      online: true,
      openclawName: name,
      openclawDeployMode: deployMode,
      openclawEndpoint: endpoint,
      openclawConnectionStatus: 'connected' as const,
      openclawLastHeartbeat: now,
      openclawApiToken: apiToken ? encryptToken(apiToken) : null,
      configSource: 'self' as const,
      executionMode,
      experienceTaskCount: 0,
      experienceTaskTypes: taskTypes || [],
      experienceTools: tools || [],
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(members).values(newMember);
    eventBus.emit({ type: 'member_update', data: { memberId: newId } });

    return {
      success: true,
      data: { memberId: newId, message: `AI 成员已自动注册`, isNew: true },
    };
  } catch (error) {
    console.error('[CoMind] handleRegisterMember error:', error);
    return { success: false, error: '注册成员失败' };
  }
}

/**
 * 获取 MCP API Token Handler
 * 
 * AI 成员通过对话信道获取自己的 MCP API Token
 * 安全考虑：只返回给 AI 成员自己
 */
export async function handleGetMcpToken(params: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const memberId = sanitizeString(params.member_id as string, 50);
  
  if (!memberId) {
    return { success: false, error: '缺少必要参数：member_id' };
  }
  
  try {
    // 查询成员
    const result = await db.select().from(members).where(eq(members.id, memberId));
    const member = result[0];
    
    if (!member) {
      return { success: false, error: '成员不存在' };
    }
    
    // 只允许 AI 成员获取自己的 Token
    if (member.type !== 'ai') {
      return { success: false, error: '只有 AI 成员可以获取 MCP Token' };
    }
    
    let decryptedToken: string;
    
    // 如果没有 Token，自动生成一个
    if (!member.openclawApiToken) {
      const newToken = generateMcpToken();
      const encryptedToken = encryptToken(newToken);
      
      await db.update(members)
        .set({ openclawApiToken: encryptedToken, updatedAt: new Date() })
        .where(eq(members.id, memberId));
      
      eventBus.emit({ type: 'member_update', data: { memberId } });
      
      decryptedToken = newToken;
    } else {
      // 解密已有 Token
      decryptedToken = decryptToken(member.openclawApiToken);
    }
    
    return {
      success: true,
      data: {
        memberId: member.id,
        memberName: member.name,
        token: decryptedToken,
        endpoint: '/api/mcp/external',
        autoGenerated: !member.openclawApiToken,
        usage: {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            tool: '工具名称',
            parameters: { /* 工具参数 */ },
          },
        },
      },
    };
  } catch (error) {
    console.error('[CoMind] handleGetMcpToken error:', error);
    return { success: false, error: '获取 MCP Token 失败' };
  }
}
