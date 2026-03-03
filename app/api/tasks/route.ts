import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, type NewTask, type Task } from '@/db';
import { eq, and, sql } from 'drizzle-orm';
import { generateTaskId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { validateEnumWithDefault, VALID_TASK_STATUS, VALID_PRIORITY } from '@/lib/validators';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { sanitizeString, isValidId } from '@/lib/security';

// GET /api/tasks - 获取所有任务（支持 source 过滤 + 分页）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  const memberId = searchParams.get('memberId');
  const source = searchParams.get('source');
  const pageRaw = parseInt(searchParams.get('page') || '0', 10) || 0;
  const limitRaw = parseInt(searchParams.get('limit') || '0', 10) || 0;
  const page = pageRaw > 0 ? Math.max(1, pageRaw) : 0;
  const limit = limitRaw > 0 ? Math.min(200, Math.max(1, limitRaw)) : 0;

  try {
    let result: Task[];

    // 构建查询条件
    const conditions = [];
    if (projectId) {
      // 校验 projectId 格式
      if (!isValidId(projectId)) {
        return NextResponse.json({ error: '无效的 projectId 格式' }, { status: 400 });
      }
      conditions.push(eq(tasks.projectId, projectId));
    }
    // 使用参数化查询防止 SQL 注入
    if (memberId) {
      if (!isValidId(memberId)) {
        return NextResponse.json({ error: '无效的 memberId 格式' }, { status: 400 });
      }
      // 安全的参数化：将 memberId 包裹后作为独立参数传入
      const likePattern = `%"${memberId}"%`;
      conditions.push(sql`assignees LIKE ${likePattern}`);
    }
    // source 过滤
    if (source === 'local' || source === 'openclaw') {
      conditions.push(eq(tasks.source, source));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 支持分页：传入 page 和 limit 时返回分页数据
    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      result = await db.select().from(tasks).where(whereClause).limit(limit).offset(offset);
      // 获取总数
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(whereClause);
      return NextResponse.json({ data: result, total: count, page, limit });
    }

    // 无分页参数时返回全量（向后兼容）
    if (conditions.length > 0) {
      result = await db.select().from(tasks).where(whereClause);
    } else {
      result = await db.select().from(tasks);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: '获取任务失败' }, { status: 500 });
  }
}

// POST /api/tasks - 创建任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 校验 title：必填、非空、长度限制
    const title = sanitizeString(body.title, 500);
    if (!title || !title.trim()) {
      console.error('[POST /api/tasks] 缺少必填字段: title');
      return NextResponse.json({ error: '缺少必填字段: title（1-500 字符）' }, { status: 400 });
    }

    // 校验 assignees 数据结构
    if (body.assignees !== undefined) {
      if (!Array.isArray(body.assignees) || !body.assignees.every((a: unknown) => typeof a === 'string')) {
        console.error('[POST /api/tasks] assignees 格式错误:', body.assignees);
        return NextResponse.json({ error: 'assignees 必须是字符串数组' }, { status: 400 });
      }
    }

    // 校验 checkItems 数据结构
    if (body.checkItems !== undefined) {
      if (!Array.isArray(body.checkItems)) {
        console.error('[POST /api/tasks] checkItems 格式错误:', body.checkItems);
        return NextResponse.json({ error: 'checkItems 必须是数组' }, { status: 400 });
      }
    }
    
    const newTask: NewTask = {
      id: generateTaskId(),
      title: title.trim(),
      description: body.description ? sanitizeString(body.description, 10000) : null,
      projectId: body.projectId || null,
      source: 'local',
      assignees: body.assignees || [],
      creatorId: body.creatorId || 'system',
      status: validateEnumWithDefault(body.status, VALID_TASK_STATUS, 'todo'),
      progress: body.progress || 0,
      priority: validateEnumWithDefault(body.priority, VALID_PRIORITY, 'medium'),
      deadline: body.deadline ? new Date(body.deadline) : null,
      checkItems: body.checkItems || [],
      attachments: body.attachments || [],
      parentTaskId: body.parentTaskId || null,
      crossProjects: body.crossProjects || [],
      // SOP 字段（可选）
      sopTemplateId: body.sopTemplateId || null,
      currentStageId: body.currentStageId || null,
      stageHistory: body.stageHistory || [],
      sopInputs: body.sopInputs || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(tasks).values(newTask);
    // 返回数据库中完整数据（确保 source 等默认字段正确）
    const [created] = await db.select().from(tasks).where(eq(tasks.id, newTask.id));
    eventBus.emit({ type: 'task_update', resourceId: newTask.id });
    triggerMarkdownSync('comind:tasks');
    return NextResponse.json(created || newTask, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tasks] 创建任务失败:', error);
    return NextResponse.json({ error: '创建任务失败' }, { status: 500 });
  }
}
