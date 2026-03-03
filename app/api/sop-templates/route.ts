import { NextRequest, NextResponse } from 'next/server';
import { db, sopTemplates, type NewSOPTemplate } from '@/db';
import { eq, and, sql } from 'drizzle-orm';
import { generateIdWithPrefix } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';

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
        return NextResponse.json({ error: `category 必须是 ${VALID_SOP_CATEGORY.join('/')} 之一` }, { status: 400 });
      }
      conditions.push(eq(sopTemplates.category, category as typeof VALID_SOP_CATEGORY[number]));
    }
    
    // 状态过滤
    if (status) {
      if (!VALID_SOP_STATUS.includes(status as typeof VALID_SOP_STATUS[number])) {
        return NextResponse.json({ error: `status 必须是 ${VALID_SOP_STATUS.join('/')} 之一` }, { status: 400 });
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
    return NextResponse.json({ error: '获取 SOP 模板失败' }, { status: 500 });
  }
}

// POST /api/sop-templates - 创建新 SOP 模板
export async function POST(request: NextRequest) {
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
      isBuiltin,
      projectId,
      createdBy,
    } = body;

    // 必填字段校验
    if (!name) {
      return NextResponse.json({ error: 'name 是必填字段' }, { status: 400 });
    }

    // 枚举校验
    if (category && !VALID_SOP_CATEGORY.includes(category)) {
      return NextResponse.json({ error: `category 必须是 ${VALID_SOP_CATEGORY.join('/')} 之一` }, { status: 400 });
    }
    if (status && !VALID_SOP_STATUS.includes(status)) {
      return NextResponse.json({ error: `status 必须是 ${VALID_SOP_STATUS.join('/')} 之一` }, { status: 400 });
    }

    // stages 校验（如果提供）
    if (stages && !Array.isArray(stages)) {
      return NextResponse.json({ error: 'stages 必须是数组' }, { status: 400 });
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
      isBuiltin: false,
      projectId: projectId || null,
      createdBy: createdBy || 'system',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(sopTemplates).values(newTemplate);
    
    // 触发事件通知
    eventBus.emit({ type: 'sop_template_update', resourceId: newTemplate.id });
    
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('[POST /api/sop-templates] Error:', error);
    return NextResponse.json({ error: '创建 SOP 模板失败' }, { status: 500 });
  }
}
