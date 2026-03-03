import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { comments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

// GET /api/comments/[id] - 获取单条评论
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    if (!comment) {
      return NextResponse.json({ error: '评论不存在' }, { status: 404 });
    }
    return NextResponse.json(comment);
  } catch (error) {
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
  }
}

// DELETE /api/comments/[id] - 删除评论
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(comments).where(eq(comments.id, id));
    if (!existing) {
      return NextResponse.json({ error: '评论不存在' }, { status: 404 });
    }
    await db.delete(comments).where(eq(comments.id, id));
    // 问题 #19：删除评论后通知前端刷新任务
    eventBus.emit({ type: 'task_update', resourceId: existing.taskId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除评论失败' }, { status: 500 });
  }
}
