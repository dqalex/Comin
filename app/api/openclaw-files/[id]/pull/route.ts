import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawFiles, openclawWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * POST /api/openclaw-files/[id]/pull
 * 从 OpenClaw 拉取文件
 */
export async function POST(
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

    if (!workspace?.path) {
      return NextResponse.json({ error: 'Workspace path not found' }, { status: 400 });
    }

    // 读取文件内容
    const filePath = join(workspace.path, file.relativePath);
    if (!filePath.startsWith(workspace.path)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'File does not exist on disk' }, { status: 404 });
    }

    // 更新同步时间
    await db.update(openclawFiles)
      .set({
        syncStatus: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(openclawFiles.id, id));

    return NextResponse.json({
      data: {
        ...file,
        content,
      },
    });
  } catch (error) {
    console.error('[API] POST /openclaw-files/[id]/pull error:', error);
    return NextResponse.json({ error: 'Pull failed' }, { status: 500 });
  }
}
