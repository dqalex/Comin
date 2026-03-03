import { NextRequest, NextResponse } from 'next/server';
import { db, members, type NewMember } from '@/db';
import { generateMemberId } from '@/lib/id';
import { sanitizeMember } from '@/lib/sanitize';
import { validateEnumWithDefault, validateEnum, VALID_MEMBER_TYPE, VALID_DEPLOY_MODE } from '@/lib/validators';
import { encryptToken, sanitizeString } from '@/lib/security';
import { invalidateMemberCache } from '@/lib/markdown-sync';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { eventBus } from '@/lib/event-bus';

// GET /api/members - 获取所有成员
export async function GET() {
  try {
    const allMembers = await db.select().from(members);
    return NextResponse.json(allMembers.map(sanitizeMember));
  } catch (error) {
    console.error('[GET /api/members]', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: `openclawDeployMode 必须是 ${VALID_DEPLOY_MODE.join('/')} 之一` }, { status: 400 });
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
      openclawTemperature: typeof openclawTemperature === 'number' ? openclawTemperature : null,
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
    
    return NextResponse.json(sanitizeMember(newMember), { status: 201 });
  } catch (error) {
    console.error('[POST /api/members]', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}

// 应用限流
export const POST = withRateLimit(handlePost, RATE_LIMITS.CREATE);
