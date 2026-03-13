import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawFiles, openclawVersions, documents, openclawWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * GET /api/openclaw-files/[id]
 * 获取文件详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 查询文件记录
    const [file] = await db.select()
      .from(openclawFiles)
      .where(eq(openclawFiles.id, id));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 查询 workspace
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, file.workspaceId));

    // 查询关联文档
    let document = null;
    if (file.documentId) {
      [document] = await db.select()
        .from(documents)
        .where(eq(documents.id, file.documentId));
    }

    // 查询版本历史
    const versions = await db.select()
      .from(openclawVersions)
      .where(eq(openclawVersions.fileId, id))
      .orderBy(openclawVersions.version);

    // 读取文件内容
    let content = '';
    if (workspace?.path) {
      const filePath = join(workspace.path, file.relativePath);
      if (!filePath.startsWith(workspace.path)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        content = '';
      }
    }

    return NextResponse.json({
      data: {
        ...file,
        content,
        document,
        versions,
      },
    });
  } catch (error) {
    console.error('[API] GET /openclaw-files/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}
