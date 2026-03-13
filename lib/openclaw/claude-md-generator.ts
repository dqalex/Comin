/**
 * CLAUDE.md 动态生成器
 *
 * 将 TeamClaw 中的项目列表、成员列表等信息写入 workspace 目录下的 CLAUDE.md，
 * 供 OpenClaw 读取，实现双向信息同步。
 *
 * CLAUDE.md = 静态协作规范 + 动态数据段（项目、成员、任务统计）
 */

import { db } from '@/db';
import { openclawWorkspaces, projects, members, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// 常量
// ============================================================

const CLAUDE_MD_FILE = 'CLAUDE.md';
const TEMPLATE_FILE = 'docs/openclaw/CLAUDE.md';

/** 动态数据段的起止标记 */
const DYNAMIC_START = '<!-- TEAMCLAW_DYNAMIC_START -->';
const DYNAMIC_END = '<!-- TEAMCLAW_DYNAMIC_END -->';

// ============================================================
// 静态模板（协作规范部分）- 从文件动态读取
// ============================================================

// 缓存模板内容，避免重复读取文件
let cachedTemplate: string | null = null;

/**
 * 获取静态模板内容
 * 从 docs/openclaw/CLAUDE.md 读取最新模板
 */
function getStaticTemplate(): string {
  if (cachedTemplate) return cachedTemplate;

  try {
    // 获取项目根目录（从当前文件路径向上两级）
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const projectRoot = join(currentDir, '../..');
    const templatePath = join(projectRoot, TEMPLATE_FILE);

    if (existsSync(templatePath)) {
      cachedTemplate = readFileSync(templatePath, 'utf-8');
      console.log(`[claude-md] 已加载模板: ${templatePath}`);
      return cachedTemplate;
    }
  } catch (error) {
    console.error('[claude-md] 读取模板文件失败:', error);
  }

  // 降级：使用内置最小模板
  console.warn('[claude-md] 使用内置最小模板');
  return getFallbackTemplate();
}

/**
 * 内置最小模板（降级使用）
 */
function getFallbackTemplate(): string {
  return `# OpenClaw × TeamClaw 协作约束

## 1. 实体映射

| OpenClaw | TeamClaw 表 | 必填 |
|----------|----------|------|
| 项目名 | projects | name |
| 任务 | tasks | title, projectId |
| 文档 | documents | title, type |
| 成员 | members | name |
| 交付物 | deliveries | documentId |

## 2. ID 与索引

**ID 由 TeamClaw 统一生成**（Base58，~11字符）。OpenClaw 无需填写。

## 3. Front Matter 必填

\`\`\`yaml
title: 文档标题
type: report | note | decision | task_output
project: 项目名
created: 2026-02-24T10:00:00Z
updated: 2026-02-24T10:00:00Z
\`\`\`

## 4. 任务识别

| 语法 | 状态 |
|------|------|
| \`- [ ]\` | todo |
| \`- [~]\` | in_progress |
| \`- [x]\` | completed |

\`@成员名\` 提及成员，自动分配任务
`;
}

/**
 * 清除模板缓存（用于热更新）
 */
export function clearTemplateCache(): void {
  cachedTemplate = null;
}

// ============================================================
// 动态数据生成
// ============================================================

interface DynamicData {
  projects: Array<{ id: string; name: string; description: string | null }>;
  members: Array<{ id: string; name: string; type: string }>;
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
  };
  generatedAt: string;
}

/**
 * 从数据库查询动态数据
 */
async function queryDynamicData(): Promise<DynamicData> {
  const [allProjects, allMembers, allTasks] = await Promise.all([
    db.select().from(projects),
    db.select().from(members),
    db.select().from(tasks),
  ]);

  const taskStats = {
    total: allTasks.length,
    todo: allTasks.filter(t => t.status === 'todo').length,
    inProgress: allTasks.filter(t => t.status === 'in_progress').length,
    completed: allTasks.filter(t => t.status === 'completed').length,
  };

  return {
    projects: allProjects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
    })),
    members: allMembers.map(m => ({
      id: m.id,
      name: m.name,
      type: m.type,
    })),
    taskStats,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 将动态数据序列化为 Markdown 段落
 */
function serializeDynamicSection(data: DynamicData): string {
  const lines: string[] = [];

  lines.push(DYNAMIC_START);
  lines.push('');
  lines.push(`## 8. TeamClaw 实时数据`);
  lines.push('');
  lines.push(`> 以下数据由 TeamClaw 自动生成，更新时间：${data.generatedAt}`);
  lines.push(`> **请勿手动编辑此段落，下次同步时会被覆盖。**`);
  lines.push('');

  // 项目列表
  lines.push('### 8.1 可用项目');
  lines.push('');
  if (data.projects.length === 0) {
    lines.push('暂无项目。');
  } else {
    lines.push('| 项目名 | ID | 说明 |');
    lines.push('|--------|-----|------|');
    for (const p of data.projects) {
      const desc = p.description ? p.description.replace(/\|/g, '\\|').slice(0, 50) : '-';
      lines.push(`| ${p.name} | ${p.id} | ${desc} |`);
    }
    lines.push('');
    lines.push('> Front Matter 中 `project` 字段必须使用上表中的**项目名**（name 列）。');
  }
  lines.push('');

  // 成员列表
  lines.push('### 8.2 可用成员');
  lines.push('');
  if (data.members.length === 0) {
    lines.push('暂无成员。');
  } else {
    lines.push('| 成员名 | ID | 类型 |');
    lines.push('|--------|-----|------|');
    for (const m of data.members) {
      const typeLabel = m.type === 'human' ? '👤 人类' : '🤖 AI';
      lines.push(`| ${m.name} | ${m.id} | ${typeLabel} |`);
    }
    lines.push('');
    lines.push('> `@成员名` 分配任务时，成员名必须使用上表中的**成员名**（name 列）。');
  }
  lines.push('');

  // 任务统计
  lines.push('### 8.3 任务概况');
  lines.push('');
  lines.push(`| 状态 | 数量 |`);
  lines.push(`|------|------|`);
  lines.push(`| 总计 | ${data.taskStats.total} |`);
  lines.push(`| 待办 | ${data.taskStats.todo} |`);
  lines.push(`| 进行中 | ${data.taskStats.inProgress} |`);
  lines.push(`| 已完成 | ${data.taskStats.completed} |`);
  lines.push('');

  lines.push(DYNAMIC_END);

  return lines.join('\n');
}

// ============================================================
// 导出 API
// ============================================================

/**
 * 生成/更新 workspace 目录下的 CLAUDE.md
 *
 * 策略：
 * - 如果文件不存在 → 用静态模板 + 动态数据段创建
 * - 如果文件存在且包含动态标记 → 只替换动态段，保留手动修改的静态部分
 * - 如果文件存在但无动态标记 → 在末尾追加动态段
 */
export async function refreshClaudeMd(workspaceId: string): Promise<boolean> {
  try {
    // 获取 workspace 路径
    const [workspace] = await db.select().from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, workspaceId));
    if (!workspace || !existsSync(workspace.path)) return false;

    const claudePath = join(workspace.path, CLAUDE_MD_FILE);
    const dynamicData = await queryDynamicData();
    const dynamicSection = serializeDynamicSection(dynamicData);

    if (existsSync(claudePath)) {
      // 文件已存在，更新动态段
      let content = readFileSync(claudePath, 'utf-8');
      const startIdx = content.indexOf(DYNAMIC_START);
      const endIdx = content.indexOf(DYNAMIC_END);

      if (startIdx !== -1 && endIdx !== -1) {
        // 替换已有的动态段
        content = content.slice(0, startIdx) + dynamicSection + content.slice(endIdx + DYNAMIC_END.length);
      } else {
        // 追加动态段
        content = content.trimEnd() + '\n\n' + dynamicSection + '\n';
      }

      writeFileSync(claudePath, content, 'utf-8');
    } else {
      // 文件不存在，创建完整文件
      const fullContent = getStaticTemplate() + '\n' + dynamicSection + '\n';
      writeFileSync(claudePath, fullContent, 'utf-8');
    }

    console.log(`[claude-md] CLAUDE.md 已更新: ${claudePath}`);
    return true;
  } catch (error) {
    console.error('[claude-md] 更新 CLAUDE.md 失败:', error);
    return false;
  }
}
