import { NextRequest, NextResponse } from 'next/server';
import { db, documents, type NewDocument } from '@/db';
import { eq, and, sql } from 'drizzle-orm';
import { generateDocId } from '@/lib/id';
import { validateEnum, validateEnumWithDefault, VALID_DOC_SOURCE, VALID_DOC_TYPE, VALID_EXTERNAL_PLATFORM, VALID_SYNC_MODE } from '@/lib/validators';
import { eventBus } from '@/lib/event-bus';
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';

// GET /api/documents - 获取所有文档（列表模式不返回 content，支持分页）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  const source = searchParams.get('source');
  const full = searchParams.get('full') === 'true';
  const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
  const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
  const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
  const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

  try {
    const conditions = [];
    if (projectId) {
      conditions.push(eq(documents.projectId, projectId));
    }
    if (source) {
      const validSource = validateEnum(source, VALID_DOC_SOURCE);
      if (!validSource) {
        return NextResponse.json({ error: `source 必须是 ${VALID_DOC_SOURCE.join('/')} 之一` }, { status: 400 });
      }
      conditions.push(eq(documents.source, validSource));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 分页模式
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const selectFields = full 
        ? db.select().from(documents)
        : db.select({
            id: documents.id, title: documents.title, projectId: documents.projectId,
            projectTags: documents.projectTags, source: documents.source, type: documents.type,
            externalPlatform: documents.externalPlatform, externalId: documents.externalId,
            externalUrl: documents.externalUrl, mcpServer: documents.mcpServer,
            lastSync: documents.lastSync, syncMode: documents.syncMode,
            links: documents.links, backlinks: documents.backlinks,
            createdAt: documents.createdAt, updatedAt: documents.updatedAt,
          }).from(documents);
      
      const result = await (selectFields as any).where(whereClause).limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    let result;
    if (full) {
      result = await db.select().from(documents).where(whereClause);
    } else {
      result = await db.select({
        id: documents.id,
        title: documents.title,
        projectId: documents.projectId,
        projectTags: documents.projectTags,
        source: documents.source,
        type: documents.type,
        externalPlatform: documents.externalPlatform,
        externalId: documents.externalId,
        externalUrl: documents.externalUrl,
        mcpServer: documents.mcpServer,
        lastSync: documents.lastSync,
        syncMode: documents.syncMode,
        links: documents.links,
        backlinks: documents.backlinks,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      }).from(documents).where(whereClause);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/documents - 创建新文档
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      title, content, projectId, projectTags, source, type,
      externalPlatform, externalId, externalUrl, mcpServer, syncMode
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const validSource = validateEnumWithDefault(source, VALID_DOC_SOURCE, 'local');
    const validType = validateEnumWithDefault(type, VALID_DOC_TYPE, 'note');
    if (externalPlatform && !validateEnum(externalPlatform, VALID_EXTERNAL_PLATFORM)) {
      return NextResponse.json({ error: `externalPlatform 必须是 ${VALID_EXTERNAL_PLATFORM.join('/')} 之一` }, { status: 400 });
    }
    if (syncMode && !validateEnum(syncMode, VALID_SYNC_MODE)) {
      return NextResponse.json({ error: `syncMode 必须是 ${VALID_SYNC_MODE.join('/')} 之一` }, { status: 400 });
    }

    const newDocument: NewDocument = {
      id: generateDocId(),
      title,
      content: content || null,
      projectId: projectId || null,
      projectTags: projectTags || [],
      source: validSource,
      type: validType,
      externalPlatform: externalPlatform || null,
      externalId: externalId || null,
      externalUrl: externalUrl || null,
      mcpServer: mcpServer || null,
      syncMode: syncMode || null,
      lastSync: null,
      links: [],
      backlinks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(documents).values(newDocument);
    
    // 如果有 content，尝试同步到看板（任务/定时任务/交付物）
    if (newDocument.content) {
      try {
        const syncResult = await syncMarkdownToDatabase(newDocument.id, newDocument.content);
        if (syncResult.synced) {
          console.log(`[POST /api/documents] 同步完成: ${newDocument.id}, type=${syncResult.type}, counts=${JSON.stringify(syncResult.counts)}`);
        }
      } catch (syncError) {
        // 同步失败不影响文档保存，只记录日志
        console.error(`[POST /api/documents] 同步失败: ${newDocument.id}`, syncError);
      }
    }
    
    // 问题 #8：POST 后通知前端刷新
    eventBus.emit({ type: 'document_update', resourceId: newDocument.id });
    return NextResponse.json(newDocument, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
