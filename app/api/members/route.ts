import { db } from '@/db';
import { members, users, type NewMember } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq, sql } from 'drizzle-orm';
import { generateMemberId, generateId } from '@/lib/id';
import { sanitizeMember } from '@/lib/sanitize';
import { validateEnumWithDefault, validateEnum, VALID_MEMBER_TYPE, VALID_DEPLOY_MODE } from '@/lib/validators';
import { encryptToken, sanitizeString } from '@/lib/security';
import { invalidateMemberCache } from '@/lib/markdown-sync';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { eventBus } from '@/lib/event-bus';
import { withAuth, withAdminAuth } from '@/lib/with-auth';
import {
  successResponse,
  createdResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';

// GET /api/members - 获取所有成员（包含关联用户的角色信息）
// v3.0: 需要登录才能访问（AI 成员是系统级共享，所有用户可见）
export const GET = withAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    // LEFT JOIN users 获取人类成员的角色信息
    const allMembers = await db
      .select({
        id: members.id,
        name: members.name,
        type: members.type,
        email: members.email,
        avatar: members.avatar,
        online: members.online,
        userId: members.userId,
        // 获取关联用户的角色（admin/member/viewer）
        userRole: sql<string | null>`${users.role}`.as('userRole'),
        // OpenClaw 相关字段
        openclawName: members.openclawName,
        openclawDeployMode: members.openclawDeployMode,
        openclawEndpoint: members.openclawEndpoint,
        openclawConnectionStatus: members.openclawConnectionStatus,
        openclawLastHeartbeat: members.openclawLastHeartbeat,
        openclawGatewayUrl: members.openclawGatewayUrl,
        openclawAgentId: members.openclawAgentId,
        openclawApiToken: members.openclawApiToken,
        openclawModel: members.openclawModel,
        openclawEnableWebSearch: members.openclawEnableWebSearch,
        openclawTemperature: members.openclawTemperature,
        configSource: members.configSource,
        executionMode: members.executionMode,
        experienceTaskCount: members.experienceTaskCount,
        experienceTaskTypes: members.experienceTaskTypes,
        experienceTools: members.experienceTools,
        createdAt: members.createdAt,
        updatedAt: members.updatedAt,
      })
      .from(members)
      .leftJoin(users, eq(members.userId, users.id));
    
    return successResponse(allMembers.map(sanitizeMember));
  } catch (error) {
    console.error(`[GET /api/members] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to fetch members'), requestId);
  }
});

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, email, openclawName, openclawDeployMode, openclawEndpoint, 
            openclawGatewayUrl, openclawAgentId, openclawApiToken, openclawModel, 
            openclawEnableWebSearch, openclawTemperature } = body;

    // 输入验证
    const sanitizedName = sanitizeString(name, 100);
    if (!sanitizedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validType = validateEnumWithDefault(type, VALID_MEMBER_TYPE, 'human');
    if (openclawDeployMode && !validateEnum(openclawDeployMode, VALID_DEPLOY_MODE)) {
      return NextResponse.json({ error: `openclawDeployMode must be one of ${VALID_DEPLOY_MODE.join('/')}` }, { status: 400 });
    }

    // 加密 Token 存储
    const encryptedToken = openclawApiToken ? encryptToken(openclawApiToken) : null;

    const newMember: NewMember = {
      id: generateMemberId(),
      name: sanitizedName,
      type: validType,
      email: sanitizeString(email, 200) || null,
      online: false,
      openclawName: sanitizeString(openclawName, 100) || null,
      openclawDeployMode: openclawDeployMode || null,
      openclawEndpoint: sanitizeString(openclawEndpoint, 500) || null,
      openclawGatewayUrl: sanitizeString(openclawGatewayUrl, 500) || null,
      openclawConnectionStatus: 'disconnected',
      openclawAgentId: sanitizeString(openclawAgentId, 100) || null,
      openclawApiToken: encryptedToken,
      openclawModel: sanitizeString(openclawModel, 50) || null,
      openclawEnableWebSearch: openclawEnableWebSearch ?? false,
      openclawTemperature: typeof openclawTemperature === 'number' ? Math.min(2.0, Math.max(0, openclawTemperature)) : null,
      experienceTaskCount: 0,
      experienceTaskTypes: [],
      experienceTools: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(members).values(newMember);
    
    // 清除成员缓存
    invalidateMemberCache();
    
    // 问题 #10：POST 后通知前端刷新
    eventBus.emit({ type: 'member_update', resourceId: newMember.id });
    
    // 返回数据库中的完整数据（而非内存构造的对象）
    const [created] = await db.select().from(members).where(eq(members.id, newMember.id));
    return NextResponse.json(sanitizeMember(created || newMember), { status: 201 });
  } catch (error) {
    console.error('[POST /api/members]', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}

// 应用限流 + 认证
// v3.0: 创建成员需要管理员权限（AI 成员是系统级资源）
export const POST = withAdminAuth(withRateLimit(handlePost, RATE_LIMITS.CREATE));
