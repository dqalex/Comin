import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawWorkspaces, openclawFiles, openclawVersions, openclawConflicts, documents, deliveries } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { stopHeartbeat } from '@/lib/openclaw/index-manager';
import { updateAutoSyncInterval, stopAutoSync } from '@/lib/openclaw/auto-sync-scheduler';
import { eventBus } from '@/lib/event-bus';

const ALLOWED_FIELDS = ['name', 'memberId', 'syncEnabled', 'watchEnabled', 'syncInterval', 'excludePatterns', 'isDefault'] as const;

/**
 * GET /api/openclaw-workspaces/[id]
 * 获取单个 workspace 详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, id));

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ data: workspace });
  } catch (error) {
    console.error('[API] GET /openclaw-workspaces/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

/**
 * PUT /api/openclaw-workspaces/[id]
 * 更新 workspace 配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 校验资源存在性
    const [existing] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // 白名单过滤
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(openclawWorkspaces)
      .set(updateData)
      .where(eq(openclawWorkspaces.id, id))
      .returning();

    // 动态更新定时全量同步调度器
    if (updated.syncEnabled) {
      const interval = updated.syncInterval || 30;
      updateAutoSyncInterval(id, interval);
    } else {
      // 禁用同步时停止定时器
      stopAutoSync(id);
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[API] PUT /openclaw-workspaces/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

/**
 * DELETE /api/openclaw-workspaces/[id]
 * 删除 workspace（不删除文件）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 校验资源存在性
    const [existing] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // 停止心跳定时器和定时同步（防止内存泄漏）
    stopHeartbeat(id);
    stopAutoSync(id);

    // 级联删除关联数据（同步事务保证一致性）
    const fileRecords = await db.select({ id: openclawFiles.id, documentId: openclawFiles.documentId })
      .from(openclawFiles)
      .where(eq(openclawFiles.workspaceId, id));
    
    const fileIds = fileRecords.map(f => f.id);
    const documentIds = fileRecords.map(f => f.documentId).filter((d): d is string => d !== null);

    db.transaction((tx) => {
      // 1. 删除冲突记录
      if (fileIds.length > 0) {
        tx.delete(openclawConflicts).where(inArray(openclawConflicts.fileId, fileIds)).run();
        // 2. 删除版本历史
        tx.delete(openclawVersions).where(inArray(openclawVersions.fileId, fileIds)).run();
        // 3. 删除文件记录
        tx.delete(openclawFiles).where(eq(openclawFiles.workspaceId, id)).run();
      }
      // 4. 清理 deliveries.documentId 引用（问题 #3）
      if (documentIds.length > 0) {
        tx.update(deliveries)
          .set({ documentId: null })
          .where(inArray(deliveries.documentId, documentIds)).run();
        // 5. 删除关联的 document 记录
        tx.delete(documents).where(inArray(documents.id, documentIds)).run();
      }
      // 6. 删除 workspace
      tx.delete(openclawWorkspaces).where(eq(openclawWorkspaces.id, id)).run();
    });

    // 通知前端刷新文档列表
    if (documentIds.length > 0) {
      eventBus.emit({ type: 'document_update' });
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error('[API] DELETE /openclaw-workspaces/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
