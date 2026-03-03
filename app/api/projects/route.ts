import { NextRequest, NextResponse } from 'next/server';
import { db, projects, type NewProject } from '@/db';
import { eq } from 'drizzle-orm';
import { generateProjectId } from '@/lib/id';
import { sanitizeString } from '@/lib/security';
import { eventBus } from '@/lib/event-bus';

// GET /api/projects - 获取所有项目（支持 source 过滤）
export async function GET(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams.get('source');

    let result;
    if (source === 'local' || source === 'openclaw') {
      result = await db.select().from(projects).where(eq(projects.source, source));
    } else {
      result = await db.select().from(projects);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = sanitizeString(body.name, 200);
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required (1-200 characters)' }, { status: 400 });
    }

    const newProject: NewProject = {
      id: generateProjectId(),
      name: name.trim(),
      description: body.description ? sanitizeString(body.description, 10000) : null,
      source: 'local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(projects).values(newProject);
    // 用 API 返回数据库中的完整数据
    const [created] = await db.select().from(projects).where(eq(projects.id, newProject.id));
    eventBus.emit({ type: 'task_update', resourceId: newProject.id });
    return NextResponse.json(created || newProject, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
