import { NextRequest, NextResponse } from 'next/server';
import { db, renderTemplates, type NewRenderTemplate } from '@/db';
import { eq, and, sql } from 'drizzle-orm';
import { generateIdWithPrefix } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';

// 有效的渲染模板分类
const VALID_RENDER_CATEGORY = ['report', 'card', 'poster', 'presentation', 'custom'] as const;
// 有效的状态
const VALID_RENDER_STATUS = ['draft', 'active', 'archived'] as const;

// GET /api/render-templates - 获取所有渲染模板（支持分页和过滤）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
  const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
  const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
  const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

  try {
    const conditions = [];
    
    // 分类过滤
    if (category) {
      if (!VALID_RENDER_CATEGORY.includes(category as typeof VALID_RENDER_CATEGORY[number])) {
        return NextResponse.json({ error: `category 必须是 ${VALID_RENDER_CATEGORY.join('/')} 之一` }, { status: 400 });
      }
      conditions.push(eq(renderTemplates.category, category as typeof VALID_RENDER_CATEGORY[number]));
    }
    
    // 状态过滤
    if (status) {
      if (!VALID_RENDER_STATUS.includes(status as typeof VALID_RENDER_STATUS[number])) {
        return NextResponse.json({ error: `status 必须是 ${VALID_RENDER_STATUS.join('/')} 之一` }, { status: 400 });
      }
      conditions.push(eq(renderTemplates.status, status as typeof VALID_RENDER_STATUS[number]));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const result = await db.select().from(renderTemplates).where(whereClause).limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(renderTemplates).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量
    const result = await db.select().from(renderTemplates).where(whereClause);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/render-templates] Error:', error);
    return NextResponse.json({ error: '获取渲染模板失败' }, { status: 500 });
  }
}

// POST /api/render-templates - 创建新渲染模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      status,
      htmlTemplate,
      mdTemplate,
      cssTemplate,
      slots,
      sections,
      exportConfig,
      thumbnail,
      isBuiltin,
      createdBy,
    } = body;

    // 必填字段校验
    if (!name) {
      return NextResponse.json({ error: 'name 是必填字段' }, { status: 400 });
    }

    // 枚举校验
    if (category && !VALID_RENDER_CATEGORY.includes(category)) {
      return NextResponse.json({ error: `category 必须是 ${VALID_RENDER_CATEGORY.join('/')} 之一` }, { status: 400 });
    }
    if (status && !VALID_RENDER_STATUS.includes(status)) {
      return NextResponse.json({ error: `status 必须是 ${VALID_RENDER_STATUS.join('/')} 之一` }, { status: 400 });
    }

    const now = new Date();
    const newTemplate: NewRenderTemplate = {
      id: generateIdWithPrefix('rnd'),
      name,
      description: description || '',
      category: category || 'custom',
      status: status || 'active',
      htmlTemplate: htmlTemplate || '',
      mdTemplate: mdTemplate || '',
      cssTemplate: cssTemplate || '',
      slots: slots || {},
      sections: sections || [],
      exportConfig: exportConfig || { formats: ['jpg', 'html'] },
      thumbnail: thumbnail || null,
      isBuiltin: isBuiltin || false,
      createdBy: createdBy || 'system',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(renderTemplates).values(newTemplate);
    
    // 触发事件通知
    eventBus.emit({ type: 'render_template_update', resourceId: newTemplate.id });
    
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('[POST /api/render-templates] Error:', error);
    return NextResponse.json({ error: '创建渲染模板失败' }, { status: 500 });
  }
}
