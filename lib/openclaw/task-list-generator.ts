/**
 * 任务列表文件生成器
 *
 * 在 workspace 的 tasks/ 目录下生成两个文件：
 * - TODO.md：待处理 + 进行中的任务（给 check-progress / sync-to-teamclaw 用）
 * - DONE.md：近 24 小时完成的任务（给 daily-report 用）
 *
 * 心跳 Skill 可直接读取本地文件获取任务上下文，无需调用 MCP API，降低 token 消耗。
 *
 * 写入时机：
 * - 心跳启动时（完整生成）
 * - 每次心跳间隔（仅在任务有变更时重写）
 *
 * 文件格式：纯 Markdown，Front Matter + 任务分组列表
 */

import { db } from '@/db';
import { openclawWorkspaces, tasks, members, projects, type CheckItem } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// ============================================================
// 常量
// ============================================================

const TODO_FILE_NAME = 'TODO.md';
const DONE_FILE_NAME = 'DONE.md';
const TASKS_DIR_NAME = 'tasks';

// 近 24 小时完成的任务窗口（毫秒）
const DONE_WINDOW_MS = 24 * 60 * 60 * 1000;

// 用于检测内容变更的 hash 缓存（避免无变更时重复写入磁盘）
// key 格式: "${workspaceId}:todo" / "${workspaceId}:done"
const HASH_CACHE_KEY = '__teamclaw_task_list_hashes__';

function getHashCache(): Map<string, string> {
  const g = globalThis as Record<string, unknown>;
  if (!g[HASH_CACHE_KEY]) {
    g[HASH_CACHE_KEY] = new Map();
  }
  return g[HASH_CACHE_KEY] as Map<string, string>;
}

// ============================================================
// 类型
// ============================================================

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  projectName: string | null;
  deadline: Date | null;
  checkItems: CheckItem[];
  updatedAt: Date;
}

// ============================================================
// 数据查询
// ============================================================

/**
 * 查询指定成员的活跃任务（todo + in_progress）
 */
async function queryMemberTasks(memberId: string): Promise<{
  tasks: TaskItem[];
  memberName: string;
}> {
  const likePattern = `%"${memberId}"%`;

  const [memberRows, taskRows, allProjects] = await Promise.all([
    db.select().from(members).where(eq(members.id, memberId)),
    db.select().from(tasks).where(
      sql`assignees LIKE ${likePattern} AND status IN ('todo', 'in_progress')`
    ),
    db.select().from(projects),
  ]);

  const memberName = memberRows[0]?.name || memberId;
  const projectMap = new Map(allProjects.map(p => [p.id, p.name]));

  const taskItems: TaskItem[] = taskRows.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    progress: t.progress || 0,
    projectName: t.projectId ? (projectMap.get(t.projectId) || null) : null,
    deadline: t.deadline,
    checkItems: (t.checkItems || []) as CheckItem[],
    updatedAt: t.updatedAt,
  }));

  // 排序：in_progress 在前，高优先级在前，截止日期近的在前
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const statusOrder: Record<string, number> = { in_progress: 0, todo: 1 };

  taskItems.sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;
    const priDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    if (priDiff !== 0) return priDiff;
    if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return { tasks: taskItems, memberName };
}

/**
 * 查询指定成员近 24 小时完成的任务
 */
async function queryMemberDoneTasks(memberId: string): Promise<{
  tasks: TaskItem[];
  memberName: string;
}> {
  const likePattern = `%"${memberId}"%`;
  const cutoff = new Date(Date.now() - DONE_WINDOW_MS);
  // updatedAt 是 integer（unix timestamp 秒），需转为秒级对比
  const cutoffTs = Math.floor(cutoff.getTime() / 1000);

  const [memberRows, taskRows, allProjects] = await Promise.all([
    db.select().from(members).where(eq(members.id, memberId)),
    db.select().from(tasks).where(
      sql`assignees LIKE ${likePattern} AND status = 'completed' AND updated_at >= ${cutoffTs}`
    ),
    db.select().from(projects),
  ]);

  const memberName = memberRows[0]?.name || memberId;
  const projectMap = new Map(allProjects.map(p => [p.id, p.name]));

  const taskItems: TaskItem[] = taskRows.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    progress: t.progress || 0,
    projectName: t.projectId ? (projectMap.get(t.projectId) || null) : null,
    deadline: t.deadline,
    checkItems: (t.checkItems || []) as CheckItem[],
    updatedAt: t.updatedAt,
  }));

  // 按完成时间倒序（最新完成的在前）
  taskItems.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return { tasks: taskItems, memberName };
}

// ============================================================
// Markdown 序列化
// ============================================================

/**
 * 将任务列表序列化为 Markdown
 */
function serializeTaskList(
  memberName: string,
  taskItems: TaskItem[],
  generatedAt: string
): string {
  const lines: string[] = [];

  // Front Matter
  lines.push('---');
  lines.push(`title: ${memberName} 的任务清单`);
  lines.push(`generated: ${generatedAt}`);
  lines.push(`member: ${memberName}`);
  lines.push(`total: ${taskItems.length}`);
  lines.push('auto_generated: true');
  lines.push('---');
  lines.push('');

  // 标题
  lines.push(`# ${memberName} 的任务清单`);
  lines.push('');
  lines.push(`> 由 TeamClaw 自动生成，更新时间：${generatedAt}`);
  lines.push(`> 包含状态为 **待处理** 和 **进行中** 的任务`);
  lines.push('');

  if (taskItems.length === 0) {
    lines.push('当前没有待处理或进行中的任务。');
    lines.push('');
    return lines.join('\n');
  }

  // 按状态分组
  const inProgress = taskItems.filter(t => t.status === 'in_progress');
  const todo = taskItems.filter(t => t.status === 'todo');

  // 进行中
  if (inProgress.length > 0) {
    lines.push(`## 🔄 进行中（${inProgress.length}）`);
    lines.push('');
    for (const t of inProgress) {
      lines.push(formatTask(t));
    }
    lines.push('');
  }

  // 待处理
  if (todo.length > 0) {
    lines.push(`## 📋 待处理（${todo.length}）`);
    lines.push('');
    for (const t of todo) {
      lines.push(formatTask(t));
    }
    lines.push('');
  }

  // 汇总
  lines.push('---');
  lines.push('');
  lines.push('## 📊 汇总');
  lines.push('');
  lines.push(`| 状态 | 数量 |`);
  lines.push(`|------|------|`);
  lines.push(`| 进行中 | ${inProgress.length} |`);
  lines.push(`| 待处理 | ${todo.length} |`);
  lines.push(`| **合计** | **${taskItems.length}** |`);
  lines.push('');

  return lines.join('\n');
}

/**
 * 格式化单条任务
 */
function formatTask(t: TaskItem): string {
  const parts: string[] = [];

  // 优先级标记
  const priIcon = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⬜' : '🟡';

  // Checkbox 样式：in_progress 用 [~]，todo 用 [ ]
  const checkbox = t.status === 'in_progress' ? '[~]' : '[ ]';

  // 主行
  let line = `- ${checkbox} ${priIcon} **${t.title}**`;
  if (t.projectName) {
    line += `（${t.projectName}）`;
  }
  parts.push(line);

  // 元信息行
  const meta: string[] = [];
  meta.push(`ID: ${t.id}`);
  if (t.progress > 0) {
    meta.push(`进度: ${t.progress}%`);
  }
  if (t.deadline) {
    const deadlineStr = formatDate(t.deadline);
    const now = new Date();
    if (t.deadline.getTime() < now.getTime()) {
      meta.push(`⚠️ 截止: ${deadlineStr}（已超期）`);
    } else {
      meta.push(`截止: ${deadlineStr}`);
    }
  }
  meta.push(`更新: ${formatDate(t.updatedAt)}`);
  parts.push(`  ${meta.join(' | ')}`);

  // CheckItems（最多显示 5 项）
  if (t.checkItems.length > 0) {
    const displayed = t.checkItems.slice(0, 5);
    for (const ci of displayed) {
      const mark = ci.completed ? '[x]' : '[ ]';
      parts.push(`  - ${mark} ${ci.text}`);
    }
    if (t.checkItems.length > 5) {
      parts.push(`  - ...还有 ${t.checkItems.length - 5} 项`);
    }
  }

  return parts.join('\n');
}

/**
 * 格式化日期为简洁字符串
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 将已完成任务列表序列化为 DONE.md Markdown
 */
function serializeDoneList(
  memberName: string,
  taskItems: TaskItem[],
  generatedAt: string
): string {
  const lines: string[] = [];

  // Front Matter
  lines.push('---');
  lines.push(`title: ${memberName} 的近期完成`);
  lines.push(`generated: ${generatedAt}`);
  lines.push(`member: ${memberName}`);
  lines.push(`total: ${taskItems.length}`);
  lines.push('window: 24h');
  lines.push('auto_generated: true');
  lines.push('---');
  lines.push('');

  lines.push(`# ${memberName} 的近期完成`);
  lines.push('');
  lines.push(`> 由 TeamClaw 自动生成，更新时间：${generatedAt}`);
  lines.push(`> 包含近 **24 小时**内完成的任务`);
  lines.push('');

  if (taskItems.length === 0) {
    lines.push('近 24 小时内没有完成的任务。');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`## ✅ 已完成（${taskItems.length}）`);
  lines.push('');

  for (const t of taskItems) {
    const priIcon = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⬜' : '🟡';
    let line = `- [x] ${priIcon} **${t.title}**`;
    if (t.projectName) {
      line += `（${t.projectName}）`;
    }
    lines.push(line);

    // 元信息
    const meta: string[] = [];
    meta.push(`ID: ${t.id}`);
    meta.push(`完成: ${formatDate(t.updatedAt)}`);
    lines.push(`  ${meta.join(' | ')}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// 文件写入
// ============================================================

/**
 * 为指定 workspace 生成任务列表文件（TODO.md + DONE.md）
 *
 * @returns true 表示至少一个文件有更新，false 表示全部无变更或失败
 */
export async function refreshTaskList(workspaceId: string): Promise<boolean> {
  try {
    // 获取 workspace 及其绑定的成员
    const [workspace] = await db.select().from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, workspaceId));

    if (!workspace || !existsSync(workspace.path)) return false;

    // 没有绑定成员则跳过
    if (!workspace.memberId) {
      return false;
    }

    const now = new Date().toISOString();

    // 并行查询活跃任务和已完成任务
    const [activeResult, doneResult] = await Promise.all([
      queryMemberTasks(workspace.memberId),
      queryMemberDoneTasks(workspace.memberId),
    ]);

    // 确保 tasks 目录存在
    const tasksDir = join(workspace.path, TASKS_DIR_NAME);
    if (!existsSync(tasksDir)) {
      mkdirSync(tasksDir, { recursive: true });
    }

    const hashCache = getHashCache();
    let anyUpdated = false;

    // 生成 TODO.md
    const todoContent = serializeTaskList(activeResult.memberName, activeResult.tasks, now);
    const todoUpdated = writeIfChanged(
      hashCache, `${workspaceId}:todo`,
      join(tasksDir, TODO_FILE_NAME), todoContent
    );
    if (todoUpdated) {
      console.log(`[task-list] TODO.md 已更新: ${join(tasksDir, TODO_FILE_NAME)} (${activeResult.tasks.length} 项任务)`);
      anyUpdated = true;
    }

    // 生成 DONE.md
    const doneContent = serializeDoneList(doneResult.memberName, doneResult.tasks, now);
    const doneUpdated = writeIfChanged(
      hashCache, `${workspaceId}:done`,
      join(tasksDir, DONE_FILE_NAME), doneContent
    );
    if (doneUpdated) {
      console.log(`[task-list] DONE.md 已更新: ${join(tasksDir, DONE_FILE_NAME)} (${doneResult.tasks.length} 项完成)`);
      anyUpdated = true;
    }

    return anyUpdated;
  } catch (error) {
    console.error('[task-list] 生成任务列表失败:', error);
    return false;
  }
}

/**
 * 对比 hash，仅在内容变更时写入文件
 */
function writeIfChanged(
  hashCache: Map<string, string>,
  cacheKey: string,
  filePath: string,
  content: string
): boolean {
  // 计算 hash 时剔除时间戳字段，避免每次心跳都判定为变更
  const stableContent = content
    .replace(/generated:.*\n/, '')
    .replace(/更新时间：.*\n/, '');
  const contentHash = createHash('sha256').update(stableContent).digest('hex');

  if (hashCache.get(cacheKey) === contentHash) {
    return false;
  }

  writeFileSync(filePath, content, 'utf-8');
  hashCache.set(cacheKey, contentHash);
  return true;
}
