import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawFiles, openclawVersions, openclawWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * POST /api/openclaw-files/[id]/push
 * 推送文件到 OpenClaw
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, expectedVersion } = body;

    if (content === undefined) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // 查询文件记录
    const [file] = await db.select()
      .from(openclawFiles)
      .where(eq(openclawFiles.id, id));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 乐观锁检查
    if (expectedVersion !== undefined && file.version !== expectedVersion) {
      // 读取当前文件内容
      const [workspace] = await db.select()
        .from(openclawWorkspaces)
        .where(eq(openclawWorkspaces.id, file.workspaceId));

      let serverContent = '';
      if (workspace?.path) {
        try {
          const filePath = join(workspace.path, file.relativePath);
          if (!filePath.startsWith(workspace.path)) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
          }
          serverContent = readFileSync(filePath, 'utf-8');
        } catch {
          // 文件可能不存在
        }
      }

      return NextResponse.json({
        error: 'CONFLICT',
        data: {
          localVersion: expectedVersion,
          serverVersion: file.version,
          serverContent,
          localContent: content,
        },
      }, { status: 409 });
    }

    // 查询 workspace
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, file.workspaceId));

    if (!workspace?.path) {
      return NextResponse.json({ error: 'Workspace path not found' }, { status: 400 });
    }

    // 构造安全的文件路径，防止路径遍历
    const filePath = join(workspace.path, file.relativePath);
    if (!filePath.startsWith(workspace.path)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // 先读取旧内容用于版本保存
    let oldContent = '';
    try {
      oldContent = readFileSync(filePath, 'utf-8');
    } catch {
      // 文件可能不存在（首次推送）
    }

    // 计算新哈希
    const newHash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    const newVersion = (file.version || 1) + 1;

    // 保存旧版本（在写入新内容之前）
    await db.insert(openclawVersions).values({
      id: generateId(),
      fileId: file.id,
      version: file.version || 1,
      hash: file.hash,
      storageType: 'full',
      content: oldContent,
      changedBy: 'teamclaw',
      createdAt: new Date(),
    });

    // 写入新内容
    writeFileSync(filePath, content, 'utf-8');

    // 更新文件记录
    const [updated] = await db.update(openclawFiles)
      .set({
        hash: newHash,
        version: newVersion,
        syncStatus: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(openclawFiles.id, id))
      .returning();

    // 直接返回对象，与其他 API 保持一致（apiRequest 会自动包装）
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] POST /openclaw-files/[id]/push error:', error);
    return NextResponse.json({ error: 'Push failed' }, { status: 500 });
  }
}
