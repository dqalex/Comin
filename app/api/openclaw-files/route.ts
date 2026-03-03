import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawFiles, openclawWorkspaces } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/openclaw-files
 * 获取文件列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');
    const fileType = searchParams.get('file_type');
    const syncStatus = searchParams.get('sync_status');
    // 保留"未传"语义：不传分页参数时返回全量数据
    const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
    const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
    const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
    const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;
    const isPaginated = page > 0 && limit > 0;

    // 构建查询条件
    const conditions = [];
    if (workspaceId) {
      conditions.push(eq(openclawFiles.workspaceId, workspaceId));
    }
    if (fileType) {
      conditions.push(eq(openclawFiles.fileType, fileType));
    }
    if (syncStatus) {
      conditions.push(eq(openclawFiles.syncStatus, syncStatus));
    }

    // 查询数据
    let query = db.select({
      file: openclawFiles,
      workspace: openclawWorkspaces,
    })
      .from(openclawFiles)
      .leftJoin(openclawWorkspaces, eq(openclawFiles.workspaceId, openclawWorkspaces.id))
      .orderBy(desc(openclawFiles.updatedAt))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (isPaginated) {
      // 分页模式：先查总数
      const countQuery = db.select({ id: openclawFiles.id })
        .from(openclawFiles)
        .$dynamic();
      const countResult = conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;
      const total = countResult.length;

      const files = await query.limit(limit).offset((page - 1) * limit);

      return NextResponse.json({
        data: files.map(f => ({
          ...f.file,
          workspaceName: f.workspace?.name,
        })),
        total,
        page,
        limit,
      });
    } else {
      // 全量模式：直接返回裸数组
      const files = await query;

      return NextResponse.json({
        data: files.map(f => ({
          ...f.file,
          workspaceName: f.workspace?.name,
        })),
      });
    }
  } catch (error) {
    console.error('[API] GET /openclaw-files error:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}
