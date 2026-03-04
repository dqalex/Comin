import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawVersions, openclawFiles, openclawWorkspaces } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * POST /api/openclaw-files/[id]/rollback
 * 回滚到指定版本
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { version } = body;

    if (!version) {
      return NextResponse.json({ error: 'version is required' }, { status: 400 });
    }

    // 查询文件记录
    const [file] = await db.select()
      .from(openclawFiles)
      .where(eq(openclawFiles.id, id));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 查询目标版本
    const [targetVersion] = await db.select()
      .from(openclawVersions)
      .where(and(
        eq(openclawVersions.fileId, id),
        eq(openclawVersions.version, version)
      ));

    if (!targetVersion || !targetVersion.content) {
      return NextResponse.json({ error: 'Version not found or content unavailable' }, { status: 404 });
    }

    // 查询 workspace
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, file.workspaceId));

    if (!workspace?.path) {
      return NextResponse.json({ error: 'Workspace path not found' }, { status: 400 });
    }

    // 保存当前版本
    const currentContent = readFileSync(join(workspace.path, file.relativePath), 'utf-8');
    await db.insert(openclawVersions).values({
      id: generateId(),
      fileId: file.id,
      version: file.version || 1,
      hash: file.hash,
      storageType: 'full',
      content: currentContent,
      changeSummary: `Before rollback to v${version}`,
      changedBy: 'comind',
      createdAt: new Date(),
    });

    // 写入目标版本内容
    writeFileSync(safePath, targetVersion.content, 'utf-8');

    // 更新文件记录
    const newHash = createHash('sha256').update(targetVersion.content).digest('hex').slice(0, 16);
    const [updated] = await db.update(openclawFiles)
      .set({
        hash: newHash,
        version: (file.version || 1) + 1,
        syncStatus: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(openclawFiles.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[API] POST /openclaw-files/[id]/rollback error:', error);
    return NextResponse.json({ error: 'Rollback failed' }, { status: 500 });
  }
}
