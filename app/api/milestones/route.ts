import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { milestones, type NewMilestone, type Milestone } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateMilestoneId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnumWithDefault, VALID_MILESTONE_STATUS } from '@/lib/validators';
import { sanitizeString, isValidId } from '@/lib/security';

// GET /api/milestones - 获取里程碑列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');

  try {
    let result: Milestone[];

    if (projectId) {
      if (!isValidId(projectId)) {
        return NextResponse.json({ error: '无效的 projectId 格式' }, { status: 400 });
      }
      result = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    } else {
      result = await db.select().from(milestones);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: '获取里程碑失败' }, { status: 500 });
  }
}

// POST /api/milestones - 创建里程碑
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = sanitizeString(body.title, 500);
    if (!title || !title.trim()) {
      return NextResponse.json({ error: '缺少必填字段: title（1-500 字符）' }, { status: 400 });
    }

    if (!body.projectId) {
      return NextResponse.json({ error: '缺少必填字段: projectId' }, { status: 400 });
    }

    const newMilestone: NewMilestone = {
      id: generateMilestoneId(),
      title: title.trim(),
      description: body.description ? sanitizeString(body.description, 5000) : null,
      projectId: body.projectId,
      status: validateEnumWithDefault(body.status, VALID_MILESTONE_STATUS, 'open'),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(milestones).values(newMilestone);
    const [created] = await db.select().from(milestones).where(eq(milestones.id, newMilestone.id));
    eventBus.emit({ type: 'milestone_update', resourceId: newMilestone.id });
    return NextResponse.json(created || newMilestone, { status: 201 });
  } catch (error) {
    console.error('[POST /api/milestones] 创建里程碑失败:', error);
    return NextResponse.json({ error: '创建里程碑失败' }, { status: 500 });
  }
}
