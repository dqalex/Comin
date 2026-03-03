/**
 * MCP Handler: 文档操作
 */

import { db } from '@/db';
import { documents } from '@/db/schema';
import { eq, sql, or, and, inArray } from 'drizzle-orm';
import { generateDocId, normalizeId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { syncMarkdownToDatabase } from '@/lib/markdown-sync';
import { VALID_DOC_TYPE } from '@/lib/validators';

/** 获取 CoMind 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建文档访问链接 */
function buildDocumentUrl(docId: string): string {
  return `${getBaseUrl()}/wiki?doc=${docId}`;
}

export async function handleGetDocument(params: Record<string, unknown>) {
  const { document_id, title } = params as { document_id?: string; title?: string };
  
  let doc;
  if (document_id) {
    const [found] = await db.select().from(documents).where(eq(documents.id, document_id));
    doc = found;
  } else if (title) {
    const [found] = await db.select().from(documents).where(sql`lower(${documents.title}) = ${title.toLowerCase()}`);
    doc = found;
  }
  
  if (!doc) {
    return { success: false, error: '文档不存在' };
  }
  
  // 返回完整的文档信息，包含访问链接
  return { 
    success: true, 
    data: {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
      url: buildDocumentUrl(doc.id),
      createdAt: doc.createdAt,
      projectId: doc.projectId,
      links: doc.links,
      backlinks: doc.backlinks,
    }
  };
}

export async function handleCreateDocument(params: Record<string, unknown>) {
  const { title, content, project_id, doc_type, tags, render_mode, render_template_id } = params as {
    title: string;
    content: string;
    project_id?: string;
    doc_type?: string;
    tags?: string[];
    // v3.0 Content Studio 扩展
    render_mode?: 'markdown' | 'visual';
    render_template_id?: string;
  };

  // 校验 doc_type
  const resolvedType = (doc_type && (VALID_DOC_TYPE as readonly string[]).includes(doc_type) ? doc_type : 'note') as typeof VALID_DOC_TYPE[number];

  // 解析 [[]] 双链（定向查询，避免全表加载）
  const linkTitles = [...(content || '').matchAll(/\[\[(.+?)\]\]/g)].map((m: RegExpMatchArray) => m[1]);
  let linkedDocs: { id: string; title: string; backlinks: string[] | null }[] = [];
  if (linkTitles.length > 0) {
    linkedDocs = await db.select({ id: documents.id, title: documents.title, backlinks: documents.backlinks })
      .from(documents)
      .where(inArray(documents.title, linkTitles));
  }
  const titleToId = new Map(linkedDocs.map(d => [d.title, d.id]));
  const linkedIds = linkTitles.map(t => titleToId.get(t)).filter(Boolean) as string[];

  const now = new Date();
  const newDoc = {
    id: generateDocId(),
    title,
    content,
    projectId: project_id || null,
    projectTags: tags || [],
    source: 'local' as const,
    links: linkedIds,
    backlinks: [] as string[],
    type: resolvedType,
    externalPlatform: null,
    externalId: null,
    externalUrl: null,
    mcpServer: null,
    syncMode: null,
    lastSync: null,
    // v3.0 Content Studio 字段
    renderMode: render_mode || 'markdown',
    renderTemplateId: render_template_id || null,
    htmlContent: null,
    slotData: null,
    // 时间戳
    createdAt: now,
    updatedAt: now,
  };
  
  await db.insert(documents).values(newDoc);

  // 更新被引用文档的 backlinks
  for (const targetDoc of linkedDocs) {
    const currentBacklinks = Array.isArray(targetDoc.backlinks) ? targetDoc.backlinks : [];
    if (!currentBacklinks.includes(newDoc.id)) {
      await db.update(documents).set({ backlinks: [...currentBacklinks, newDoc.id] }).where(eq(documents.id, targetDoc.id));
    }
  }
  
  eventBus.emit({ type: 'document_update', resourceId: newDoc.id });

  let syncResult = null;
  if (content) {
    syncResult = await syncMarkdownToDatabase(newDoc.id, content);
  }

  // 返回友好的响应格式，包含访问链接
  return { 
    success: true, 
    data: {
      id: newDoc.id,
      documentId: newDoc.id,  // 兼容字段
      title: newDoc.title,
      type: resolvedType,
      docType: resolvedType,  // 兼容字段
      url: buildDocumentUrl(newDoc.id),
      createdAt: now.toISOString(),
      tags: tags || [],
      renderMode: newDoc.renderMode,
      renderTemplateId: newDoc.renderTemplateId,
      message: '文档已创建',
      _sync: syncResult,
    }
  };
}

export async function handleUpdateDocument(params: Record<string, unknown>) {
  const { document_id, content, doc_type } = params as {
    document_id: string;
    content: string;
    doc_type?: string;
  };
  const [doc] = await db.select().from(documents).where(eq(documents.id, document_id));
  
  if (!doc) {
    return { success: false, error: '文档不存在' };
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    content, 
    updatedAt: now,
  };

  // 如果传入了有效的 doc_type，更新类型
  if (doc_type && (VALID_DOC_TYPE as readonly string[]).includes(doc_type)) {
    updateData.type = doc_type;
  }

  await db.update(documents).set(updateData).where(eq(documents.id, document_id));

  // 自动解析 [[]] 双链并更新 links / backlinks（定向查询，避免全表加载）
  const linkTitles = [...(content || '').matchAll(/\[\[(.+?)\]\]/g)].map((m: RegExpMatchArray) => m[1]);
  let linkedDocs: { id: string; title: string; backlinks: string[] | null }[] = [];
  if (linkTitles.length > 0) {
    linkedDocs = await db.select({ id: documents.id, title: documents.title, backlinks: documents.backlinks })
      .from(documents)
      .where(inArray(documents.title, linkTitles));
  }
  const titleToId = new Map(linkedDocs.map(d => [d.title, d.id]));
  const linkedIds = linkTitles.map(t => titleToId.get(t)).filter(Boolean) as string[];

  await db.update(documents).set({ links: linkedIds }).where(eq(documents.id, document_id));

  // 添加 backlinks：查找被链接但还未 backlink 指向当前文档的
  if (linkedIds.length > 0) {
    const docsNeedBacklink = await db.select({ id: documents.id, backlinks: documents.backlinks })
      .from(documents)
      .where(and(
        inArray(documents.id, linkedIds),
        sql`NOT (backlinks LIKE ${`%"${document_id}"%`})`,
      ));
    for (const targetDoc of docsNeedBacklink) {
      const currentBacklinks = Array.isArray(targetDoc.backlinks) ? targetDoc.backlinks : [];
      await db.update(documents).set({ backlinks: [...currentBacklinks, document_id] }).where(eq(documents.id, targetDoc.id));
    }
  }

  // 移除旧的 backlinks：查找之前链接但现在不再链接的
  const docsWithOldBacklinks = await db.select({ id: documents.id, backlinks: documents.backlinks })
    .from(documents)
    .where(sql`backlinks LIKE ${`%"${document_id}"%`}`);
  for (const oldDoc of docsWithOldBacklinks) {
    if (oldDoc.id === document_id || linkedIds.includes(oldDoc.id)) continue;
    const currentBacklinks = Array.isArray(oldDoc.backlinks) ? oldDoc.backlinks : [];
    await db.update(documents).set({ backlinks: currentBacklinks.filter(b => b !== document_id) }).where(eq(documents.id, oldDoc.id));
  }
  
  eventBus.emit({ type: 'document_update', resourceId: document_id });

  const syncResult = await syncMarkdownToDatabase(document_id, content);

  // 返回友好的响应格式
  return { 
    success: true, 
    data: {
      id: document_id,
      documentId: document_id,
      title: doc.title,
      url: buildDocumentUrl(document_id),
      updatedAt: now.toISOString(),
      message: '文档已更新',
      _sync: syncResult.synced ? syncResult : undefined,
    }
  };
}

export async function handleSearchDocuments(params: Record<string, unknown>) {
  const { query, project_id } = params as { query: string; project_id?: string };
  
  // Escape LIKE wildcards to prevent pattern injection
  const escapedQuery = query.replace(/[%_]/g, '\\$&');
  const likePattern = `%${escapedQuery}%`;
  
  // Build conditions using Drizzle's type-safe operators
  const searchConditions = or(
    sql`lower(${documents.title}) LIKE lower(${likePattern}) ESCAPE '\\'`,
    sql`lower(${documents.content}) LIKE lower(${likePattern}) ESCAPE '\\'`
  );
  
  const whereCondition = project_id 
    ? and(searchConditions, eq(documents.projectId, project_id))
    : searchConditions;
  
  const results = await db
    .select({ id: documents.id, title: documents.title, type: documents.type, createdAt: documents.createdAt })
    .from(documents)
    .where(whereCondition)
    .limit(50);
  
  // 为每个结果添加访问链接，标题匹配的排在前面
  const lowerQuery = query.toLowerCase();
  const resultsWithUrl = results.map(r => ({
    ...r,
    url: buildDocumentUrl(r.id),
  })).sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
    const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
    return aTitle - bTitle;
  });
  
  return { 
    success: true, 
    data: resultsWithUrl,
  };
}
