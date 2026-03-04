import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawConflicts, openclawFiles, openclawWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * POST /api/openclaw-conflicts/[id]/resolve
 * 解决冲突
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution, mergedContent } = body;

    if (!resolution || !['local', 'remote', 'merged'].includes(resolution)) {
      return NextResponse.json(
        { error: 'resolution must be one of: local, remote, merged' },
        { status: 400 }
      );
    }

    if (resolution === 'merged' && !mergedContent) {
      return NextResponse.json(
        { error: 'mergedContent is required when resolution is "merged"' },
        { status: 400 }
      );
    }

    // 查询冲突记录
    const [conflict] = await db.select()
      .from(openclawConflicts)
      .where(eq(openclawConflicts.id, id));

    if (!conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    if (conflict.status !== 'pending') {
      return NextResponse.json({ error: 'Conflict already resolved' }, { status: 400 });
    }

    // 确定最终内容
    let finalContent: string;
    switch (resolution) {
      case 'local':
        finalContent = conflict.localContent;
        break;
      case 'remote':
        finalContent = conflict.remoteContent;
        break;
      case 'merged':
        finalContent = mergedContent;
        break;
      default:
        return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 });
    }

    // 查询文件记录
    const [file] = await db.select()
      .from(openclawFiles)
      .where(eq(openclawFiles.id, conflict.fileId));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 查询 workspace
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, file.workspaceId));

    // 原子操作：更新冲突状态 + 更新文件状态
    const newHash = createHash('sha256').update(finalContent).digest('hex').slice(0, 16);
    const newVersion = Math.max(conflict.localVersion, conflict.remoteVersion) + 1;

    const [updated] = await db.transaction(async (tx) => {
      // 更新冲突状态
      const [conflictResult] = await tx.update(openclawConflicts)
        .set({
          status: 'resolved',
          resolution,
          mergedContent: resolution === 'merged' ? mergedContent : null,
          resolvedAt: new Date(),
        })
        .where(eq(openclawConflicts.id, id))
        .returning();

      // 更新文件状态
      await tx.update(openclawFiles)
        .set({
          hash: newHash,
          version: newVersion,
          syncStatus: 'synced',
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(openclawFiles.id, conflict.fileId));

      return [conflictResult];
    });

    // 写入文件（事务成功后再写磁盘）
    if (workspace?.path) {
      const filePath = join(workspace.path, file.relativePath);
      if (!filePath.startsWith(workspace.path)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }
      writeFileSync(filePath, finalContent, 'utf-8');
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[API] POST /openclaw-conflicts/[id]/resolve error:', error);
    return NextResponse.json({ error: 'Failed to resolve conflict' }, { status: 500 });
  }
}
