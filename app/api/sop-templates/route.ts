import { db } from '@/db';
import { sopTemplates, type NewSOPTemplate } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { eq, and, sql } from 'drizzle-orm';
import { generateIdWithPrefix, generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { withAuth } from '@/lib/with-auth';
import { errorResponse, createdResponse, ApiErrors } from '@/lib/api-route-factory';

// 有效的 SOP 分类
const VALID_SOP_CATEGORY = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'] as const;
// 有效的 SOP 状态
const VALID_SOP_STATUS = ['draft', 'active', 'archived'] as const;

// GET /api/sop-templates - 获取所有 SOP 模板（支持分页和过滤）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const projectId = searchParams.get('projectId');
  const includeGlobal = searchParams.get('includeGlobal') !== 'false'; // 默认包含全局模板
  const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
  const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
  const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
  const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

  try {
    const conditions = [];
    
    // 分类过滤
    if (category) {
      if (!VALID_SOP_CATEGORY.includes(category as typeof VALID_SOP_CATEGORY[number])) {
        return NextResponse.json({ error: `category must be one of ${VALID_SOP_CATEGORY.join('/')}` }, { status: 400 });
      }
      conditions.push(eq(sopTemplates.category, category as typeof VALID_SOP_CATEGORY[number]));
    }
    
    // 状态过滤
    if (status) {
      if (!VALID_SOP_STATUS.includes(status as typeof VALID_SOP_STATUS[number])) {
        return NextResponse.json({ error: `status must be one of ${VALID_SOP_STATUS.join('/')}` }, { status: 400 });
      }
      conditions.push(eq(sopTemplates.status, status as typeof VALID_SOP_STATUS[number]));
    }
    
    // 项目过滤（支持全局模板）
    if (projectId) {
      if (includeGlobal) {
        // 包含指定项目的模板和全局模板（projectId 为 null）
        conditions.push(
          sql`(${sopTemplates.projectId} = ${projectId} OR ${sopTemplates.projectId} IS NULL)`
        );
      } else {
        conditions.push(eq(sopTemplates.projectId, projectId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const result = await db.select().from(sopTemplates).where(whereClause).limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(sopTemplates).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量
    const result = await db.select().from(sopTemplates).where(whereClause);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/sop-templates] Error:', error);
    return NextResponse.json({ error: 'Failed to get SOP templates' }, { status: 500 });
  }
}

// POST /api/sop-templates - 创建新 SOP 模板
// v3.0: 需要登录才能创建
export const POST = withAuth(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      icon,
      status,
      stages,
      requiredTools,
      systemPrompt,
      knowledgeConfig,
      outputConfig,
      qualityChecklist,
      projectId,
      createdBy,
      references,   // v3.1 新增
      scripts,      // v3.1 新增
    } = body;

    // 必填字段校验
    if (!name) {
      return errorResponse(ApiErrors.badRequest('name is a required field'), requestId);
    }

    // 枚举校验
    if (category && !VALID_SOP_CATEGORY.includes(category)) {
      return errorResponse(ApiErrors.badRequest(`category must be one of ${VALID_SOP_CATEGORY.join('/')}`), requestId);
    }
    if (status && !VALID_SOP_STATUS.includes(status)) {
      return errorResponse(ApiErrors.badRequest(`status must be one of ${VALID_SOP_STATUS.join('/')}`), requestId);
    }

    // stages 校验（如果提供）
    if (stages && !Array.isArray(stages)) {
      return errorResponse(ApiErrors.badRequest('stages must be an array'), requestId);
    }

    // v3.1: references 和 scripts 校验
    if (references && !Array.isArray(references)) {
      return errorResponse(ApiErrors.badRequest('references must be an array'), requestId);
    }
    if (scripts && !Array.isArray(scripts)) {
      return errorResponse(ApiErrors.badRequest('scripts must be an array'), requestId);
    }

    const now = new Date();
    const newTemplate: NewSOPTemplate = {
      id: generateIdWithPrefix('sop'),
      name,
      description: description || '',
      category: category || 'custom',
      icon: icon || 'clipboard-list',
      status: status || 'active',
      stages: stages || [],
      requiredTools: requiredTools || [],
      systemPrompt: systemPrompt || '',
      knowledgeConfig: knowledgeConfig || null,
      outputConfig: outputConfig || null,
      qualityChecklist: qualityChecklist || [],
      references: references || [],      // v3.1 新增
      scripts: scripts || [],            // v3.1 新增
      isBuiltin: false,
      projectId: projectId || null,
      createdBy: createdBy || 'system',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(sopTemplates).values(newTemplate);
    
    // 触发事件通知
    eventBus.emit({ type: 'sop_template_update', resourceId: newTemplate.id });
    
    return createdResponse(newTemplate);
  } catch (error) {
    console.error(`[POST /api/sop-templates] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to create SOP template'), requestId);
  }
});
