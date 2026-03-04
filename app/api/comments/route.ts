import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { comments, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateCommentId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { triggerMarkdownSync } from '@/lib/markdown-sync';

// GET /api/comments - 获取评论（按任务ID过滤）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  try {
    let result;
    if (taskId) {
      result = await db.select().from(comments).where(eq(comments.taskId, taskId));
    } else {
      result = await db.select().from(comments);
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
  }
}

// POST /api/comments - 创建评论
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, memberId, content } = body;

    if (!taskId || !content) {
      return NextResponse.json({ error: 'taskId 和 content 为必填' }, { status: 400 });
    }

    // 校验 taskId 存在
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
    if (!task) {
      return NextResponse.json({ error: '关联任务不存在' }, { status: 404 });
    }

    const now = new Date();
    const newComment = {
      id: generateCommentId(),
      taskId,
      memberId: memberId || 'system',
      content,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(comments).values(newComment);
    eventBus.emit({ type: 'task_update', resourceId: taskId });
    triggerMarkdownSync('comind:tasks');
    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '创建评论失败' }, { status: 500 });
  }
}
