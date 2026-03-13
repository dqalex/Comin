/**
 * 任务同步：Markdown ↔ 任务看板
 */

import { db } from '@/db';
import { tasks, documents } from '@/db/schema';
import type { Task, CheckItem } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateTaskId, generateCheckItemId, normalizeId, isUuidFormat } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { getMembers, memberNameToId } from './shared';
import type { SyncType } from './shared';

// ============================================================
// 类型
// ============================================================

interface ParsedTask {
  title: string;
  status: 'todo' | 'in_progress' | 'reviewing' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignees: string[];
  progress: number;
  description?: string;
  deadline?: string;
  checkItems: { text: string; completed: boolean }[];
  docLinks: string[];
}

// ============================================================
// 解析常量
// ============================================================

const STATUS_HEADERS: Record<string, Task['status']> = {
  '待办事项': 'todo',
  '待办': 'todo',
  'todo': 'todo',
  '进行中': 'in_progress',
  'in progress': 'in_progress',
  '审核中': 'reviewing',
  'reviewing': 'reviewing',
  '已完成': 'completed',
  'completed': 'completed',
};

const PRIORITY_HEADERS: Record<string, Task['priority']> = {
  '高优先级': 'high',
  '高优': 'high',
  'high': 'high',
  '中优先级': 'medium',
  '中优': 'medium',
  'medium': 'medium',
  '低优先级': 'low',
  '低优': 'low',
  'low': 'low',
};

// ============================================================
// 解析 (Markdown → Data)
// ============================================================

export function parseTasksFromMarkdown(body: string): ParsedTask[] {
  const result: ParsedTask[] = [];
  const lines = body.split('\n');

  let currentStatus: Task['status'] = 'todo';
  let currentPriority: Task['priority'] = 'medium';
  let currentTask: ParsedTask | null = null;
  // 标记当前是否在任务区域
  // 默认为 true（文档类型已确认为 teamclaw:tasks），遇到非任务的 ## 标题（如"当前进度"、"相关文档"）时退出
  let inTaskZone = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      // 遇到新的 ## 标题时，先保存上一个任务
      if (currentTask) { result.push(currentTask); currentTask = null; }

      const heading = trimmed.slice(3).trim().toLowerCase();
      // 去除 emoji 前缀（如 📋 🔴 📝）后匹配
      const cleanHeading = heading.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '').trim();
      
      let matched = false;
      for (const [keyword, status] of Object.entries(STATUS_HEADERS)) {
        if (cleanHeading.includes(keyword.toLowerCase())) {
          currentStatus = status;
          currentPriority = 'medium';
          inTaskZone = true;
          matched = true;
          break;
        }
      }
      // 包含"任务"关键词的 ## 标题也视为任务区域（如"🔴 任务清单"、"任务分工"）
      if (!matched && (cleanHeading.includes('任务') || cleanHeading.includes('task'))) {
        inTaskZone = true;
      } else if (!matched) {
        // 不匹配的 ## 标题（如"📝 当前进度"、"📂 相关文档"）标记为非任务区域
        inTaskZone = false;
      }
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const subHeading = trimmed.slice(4).trim().toLowerCase();
      for (const [keyword, priority] of Object.entries(PRIORITY_HEADERS)) {
        if (subHeading.includes(keyword.toLowerCase())) {
          currentPriority = priority;
          break;
        }
      }
      continue;
    }

    // 非任务区域内的 checkbox 行跳过，不作为任务解析
    if (!inTaskZone) continue;

    const taskMatch = trimmed.match(/^- \[([ x\-?~!])\]\s+(.+)$/);
    if (taskMatch && !line.match(/^\s{2,}-/)) {
      if (currentTask) result.push(currentTask);

      const checkChar = taskMatch[1];
      const rest = taskMatch[2];

      let taskStatus = currentStatus;
      let taskPriority = currentPriority;
      
      // 状态解析：[ ] todo, [~] in_progress, [?] reviewing, [x] completed
      // [-] 兼容旧格式 in_progress
      if (checkChar === 'x') taskStatus = 'completed';
      else if (checkChar === '-' || checkChar === '~') taskStatus = 'in_progress';
      else if (checkChar === '?') taskStatus = 'reviewing';
      // [!] 高优先级 + todo 状态
      else if (checkChar === '!') {
        taskStatus = 'todo';
        taskPriority = 'high';
      }

      const assignees: string[] = [];
      const docLinks: string[] = [];
      let title = rest;
      
      // 解析 @成员
      const atMatches = rest.matchAll(/@(\S+)/g);
      for (const m of atMatches) {
        assignees.push(m[1]);
      }
      title = title.replace(/@\S+/g, '').trim();
      
      // 解析 [[文档名]] 链接（任务行内）
      const linkMatches = title.matchAll(/\[\[(.+?)\]\]/g);
      for (const m of linkMatches) {
        docLinks.push(m[1]);
      }
      title = title.replace(/\[\[.+?\]\]/g, '').trim();
      
      // 解析 #task_xxx 任务引用
      const taskRefMatches = title.matchAll(/#(\S+)/g);
      for (const m of taskRefMatches) {
        if (m[1].startsWith('task_') || m[1].startsWith('task-')) {
          docLinks.push(`task:${m[1]}`);
        }
      }
      title = title.replace(/#\S+/g, '').trim();

      let progress = 0;
      const progressMatch = title.match(/\[(\d+)%\]/);
      if (progressMatch) {
        progress = parseInt(progressMatch[1], 10);
        title = title.replace(/\[\d+%\]/, '').trim();
      }

      currentTask = {
        title,
        status: taskStatus,
        priority: taskPriority,
        assignees,
        progress,
        checkItems: [],
        docLinks,
      };
      continue;
    }

    if (currentTask && trimmed.length > 0) {
      const checkMatch = trimmed.match(/^- \[([ x])\]\s+(.+)$/);
      if (checkMatch && line.match(/^\s{2,}-/)) {
        currentTask.checkItems.push({
          text: checkMatch[2].trim(),
          completed: checkMatch[1] === 'x',
        });
        continue;
      }

      if (trimmed.startsWith('> ')) {
        const content = trimmed.slice(2).trim();
        const deadlineMatch = content.match(/截止日期[:：]\s*(\d{4}-\d{2}-\d{2})/);
        if (deadlineMatch) {
          currentTask.deadline = deadlineMatch[1];
          continue;
        }
        const docLinkMatches = content.matchAll(/\[\[(.+?)\]\]|doc:([a-zA-Z0-9-]+)/g);
        for (const m of docLinkMatches) {
          const link = m[1] || `doc:${m[2]}`;
          if (link.startsWith('doc:') && isUuidFormat(link.slice(4))) {
            currentTask.docLinks.push(`doc:${normalizeId(link.slice(4))}`);
          } else {
            currentTask.docLinks.push(link);
          }
        }
        if (currentTask.description) {
          currentTask.description += '\n' + content;
        } else {
          currentTask.description = content;
        }
        continue;
      }
    }
  }

  if (currentTask) result.push(currentTask);
  return result;
}

// ============================================================
// 序列化 (Data → Markdown)：全量生成（仅用于新建文档时的初始内容）
// ============================================================

export async function serializeTasks(allTasks: Task[], projectId?: string): Promise<string> {
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: teamclaw:tasks');
  if (projectId) lines.push(`project: ${projectId}`);
  lines.push('---');
  lines.push('');

  const membersList = await getMembers();
  const nameMap = new Map(membersList.map(m => [m.id, m.name]));

  const groups: { heading: string; status: Task['status'] }[] = [
    { heading: '待办事项', status: 'todo' },
    { heading: '进行中', status: 'in_progress' },
    { heading: '审核中', status: 'reviewing' },
    { heading: '已完成', status: 'completed' },
  ];

  for (const { heading, status } of groups) {
    const filtered = allTasks.filter(t => t.status === status);
    if (filtered.length === 0) continue;

    lines.push(`## ${heading}`);
    lines.push('');

    if (status === 'todo') {
      const priorities: { label: string; priority: Task['priority'] }[] = [
        { label: '高优先级', priority: 'high' },
        { label: '中优先级', priority: 'medium' },
        { label: '低优先级', priority: 'low' },
      ];

      for (const { label, priority } of priorities) {
        const pTasks = filtered.filter(t => t.priority === priority);
        if (pTasks.length === 0) continue;
        lines.push(`### ${label}`);
        for (const t of pTasks) {
          lines.push(serializeTaskLine(t, nameMap, ' '));
        }
        lines.push('');
      }
    } else {
      for (const t of filtered) {
        const checkChar = status === 'completed' ? 'x' : status === 'in_progress' ? '-' : status === 'reviewing' ? '?' : ' ';
        lines.push(serializeTaskLine(t, nameMap, checkChar));
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function serializeTaskLine(t: Task, nameMap: Map<string, string>, checkChar: string): string {
  let char = checkChar;
  if (t.priority === 'high' && t.status === 'todo') {
    char = '!';
  } else if (t.status === 'in_progress') {
    char = '~';
  }
  
  let line = `- [${char}] ${t.title}`;

  if (t.assignees && t.assignees.length > 0) {
    const names = t.assignees.map(id => nameMap.get(id) || id);
    line += ' ' + names.map(n => `@${n}`).join(' ');
  }

  if (t.attachments && t.attachments.length > 0) {
    for (const att of t.attachments) {
      if (att.startsWith('doc:')) {
        line += ` [[doc:${att.slice(4)}]]`;
      }
    }
  }

  if (t.progress && t.progress > 0 && t.progress < 100) {
    line += ` [${t.progress}%]`;
  }

  const subLines: string[] = [line];

  if (t.description) {
    for (const descLine of t.description.split('\n')) {
      subLines.push(`    > ${descLine}`);
    }
  }

  if (t.deadline) {
    const d = new Date(t.deadline);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    subLines.push(`    > 截止日期: ${dateStr}`);
  }

  if (t.checkItems && t.checkItems.length > 0) {
    for (const item of t.checkItems) {
      subLines.push(`    - [${item.completed ? 'x' : ' '}] ${item.text}`);
    }
  }

  return subLines.join('\n');
}

// ============================================================
// 原地更新 (Data → Markdown)：保留原文档结构，仅更新 checkbox 状态
// ============================================================

/**
 * 原地更新文档中的任务 checkbox 状态，不改变文档其他内容。
 * - 匹配每个 `- [ ]`/`- [x]` 行的标题，从数据库中查找对应任务
 * - 只替换 checkbox 标记字符（空格/x/~/!/?）
 * - 子任务同理，根据 checkItems 更新
 * - 已从数据库删除的任务移到文档底部 `## 📦 已归档` 区域
 * 
 * @returns 更新后的完整文档内容（包括 frontmatter）
 */
export function patchTaskStatusInMarkdown(
  originalContent: string,
  dbTasks: Task[],
): string {
  const lines = originalContent.split('\n');
  const result: string[] = [];
  // 收集需要归档的任务行（文档中存在但数据库中已删除）
  const archivedLines: string[] = [];
  
  // 按标题建立任务索引
  const taskByTitle = new Map(dbTasks.map(t => [t.title, t]));
  // 跟踪文档中遇到的主任务标题
  const docTaskTitles = new Set<string>();
  
  let currentDbTask: Task | null = null;
  let inTaskZone = true; // 默认在任务区域
  // 跟踪当前是否在一个"被删除的任务"区域内（需要收集到归档）
  let collectingForArchive = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ## 标题：判断是否在任务区域
    if (trimmed.startsWith('## ')) {
      currentDbTask = null;
      collectingForArchive = false;
      const heading = trimmed.slice(3).trim().toLowerCase();
      const cleanHeading = heading.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '').trim();
      
      // 跳过已有的归档区域（将在最后重新生成）
      if (cleanHeading.includes('已归档') || cleanHeading.includes('archived')) {
        // 收集已有归档内容
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('## ')) {
          const archiveLine = lines[i].trim();
          if (archiveLine.length > 0) {
            archivedLines.push(lines[i]);
          }
          i++;
        }
        i--; // 回退一行
        continue;
      }
      
      let matched = false;
      for (const keyword of Object.keys(STATUS_HEADERS)) {
        if (cleanHeading.includes(keyword.toLowerCase())) {
          inTaskZone = true;
          matched = true;
          break;
        }
      }
      if (!matched && (cleanHeading.includes('任务') || cleanHeading.includes('task'))) {
        inTaskZone = true;
      } else if (!matched) {
        inTaskZone = false;
      }
      result.push(line);
      continue;
    }

    // 非任务区域，原样保留
    if (!inTaskZone) {
      result.push(line);
      continue;
    }

    // 主任务行：`- [x] 任务标题 @成员 [[文档]]`
    const mainTaskMatch = trimmed.match(/^- \[([ x\-?~!])\]\s+(.+)$/);
    if (mainTaskMatch && !line.match(/^\s{2,}-/)) {
      collectingForArchive = false;
      const rest = mainTaskMatch[2];
      // 提取纯标题（去掉 @成员、[[文档]]、[进度%]、#标签）
      const pureTitle = rest
        .replace(/@\S+/g, '')
        .replace(/\[\[.+?\]\]/g, '')
        .replace(/\[\d+%\]/g, '')
        .replace(/#\S+/g, '')
        .trim();
      
      docTaskTitles.add(pureTitle);
      const dbTask = taskByTitle.get(pureTitle);
      
      if (dbTask) {
        currentDbTask = dbTask;
        // 确定新的 checkbox 标记
        const newChar = getCheckChar(dbTask.status, dbTask.priority);
        // 替换行中的 checkbox 标记
        const indent = line.match(/^(\s*)/)?.[1] || '';
        result.push(line.replace(/^(\s*)- \[[ x\-?~!]\]/, `${indent}- [${newChar}]`));
      } else {
        // 数据库中不存在此任务 → 归档
        currentDbTask = null;
        collectingForArchive = true;
        archivedLines.push(line);
      }
      continue;
    }

    // 子任务行：缩进的 `- [ ] 子任务文本`
    const subTaskMatch = trimmed.match(/^- \[([ x])\]\s+(.+)$/);
    if (subTaskMatch && line.match(/^\s{2,}-/)) {
      // 如果当前在归档模式，子任务也归档
      if (collectingForArchive) {
        archivedLines.push(line);
        continue;
      }
      if (currentDbTask) {
        const subText = subTaskMatch[2].trim();
        const checkItem = currentDbTask.checkItems?.find(
          (ci: CheckItem) => ci.text === subText
        );
        if (checkItem) {
          const newChar = checkItem.completed ? 'x' : ' ';
          result.push(line.replace(/- \[[ x]\]/, `- [${newChar}]`));
        } else {
          result.push(line);
        }
        continue;
      }
      // 没有对应主任务的子任务行，原样保留
      result.push(line);
      continue;
    }

    // 描述行（> 开头）和空行：跟随归档或保留
    if (collectingForArchive) {
      // 描述行跟随归档
      if (trimmed.startsWith('>') || trimmed === '') {
        archivedLines.push(line);
        continue;
      }
      // 非描述非任务行，结束归档收集
      collectingForArchive = false;
    }

    // 其他行（标题、描述、空行等）：原样保留
    result.push(line);
  }

  // 如果有归档的任务，追加到文档底部
  if (archivedLines.length > 0) {
    // 确保结尾有空行
    const lastLine = result[result.length - 1]?.trim();
    if (lastLine !== '') result.push('');
    
    result.push('---');
    result.push('');
    result.push('## 📦 已归档');
    result.push('');
    for (const archiveLine of archivedLines) {
      result.push(archiveLine);
    }
    result.push('');
  }
  
  return result.join('\n');
}

/**
 * 根据任务状态和优先级返回对应的 checkbox 标记字符
 */
function getCheckChar(status: Task['status'], priority: Task['priority']): string {
  if (status === 'completed') return 'x';
  if (status === 'in_progress') return '~';
  if (status === 'reviewing') return '?';
  if (status === 'todo' && priority === 'high') return '!';
  return ' ';
}

// ============================================================
// 同步：Markdown → 数据库
// ============================================================

export async function syncTasks(documentId: string, body: string, projectId?: string): Promise<{ synced: boolean; type: SyncType; counts: Record<string, number> }> {
  const parsed = parseTasksFromMarkdown(body);
  const counts = { created: 0, updated: 0, deleted: 0 };

  let existingTasks: Task[];
  if (projectId) {
    existingTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  } else {
    const allTasks = await db.select().from(tasks);
    existingTasks = allTasks.filter(t => t.attachments?.includes(`sync:${documentId}`));
  }

  const existingMap = new Map(existingTasks.map(t => [t.title, t]));
  const parsedTitles = new Set(parsed.map(p => p.title));

  for (const p of parsed) {
    const existing = existingMap.get(p.title);

    const assigneeIds: string[] = [];
    for (const name of p.assignees) {
      const id = await memberNameToId(name);
      if (id) assigneeIds.push(id);
    }

    const attachments: string[] = [`sync:${documentId}`];
    for (const link of p.docLinks) {
      if (link.startsWith('doc:')) {
        const docId = normalizeId(link.slice(4));
        attachments.push(`doc:${docId}`);
      } else {
        const [doc] = await db.select({ id: documents.id }).from(documents)
          .where(sql`lower(${documents.title}) = ${link.toLowerCase()}`);
        if (doc) attachments.push(`doc:${doc.id}`);
      }
    }

    const checkItems: CheckItem[] = p.checkItems.map(ci => ({
      id: generateCheckItemId(),
      text: ci.text,
      completed: ci.completed,
    }));

    if (existing) {
      const mergedCheckItems = mergeCheckItems(existing.checkItems || [], checkItems);
      
      const updateData: Record<string, unknown> = {
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        assignees: assigneeIds.length > 0 ? assigneeIds : existing.assignees,
        checkItems: mergedCheckItems,
        updatedAt: new Date(),
      };
      if (p.description !== undefined) updateData.description = p.description;
      if (p.deadline) updateData.deadline = new Date(p.deadline);
      if (attachments.length > 0) updateData.attachments = attachments;

      await db.update(tasks).set(updateData).where(eq(tasks.id, existing.id));
      eventBus.emit({ type: 'task_update', resourceId: existing.id });
      counts.updated++;
    } else {
      const newId = generateTaskId();
      const newTask = {
        id: newId,
        title: p.title,
        description: p.description || null,
        projectId: projectId || null,
        assignees: assigneeIds,
        creatorId: 'markdown-sync',
        status: p.status,
        progress: p.progress,
        priority: p.priority,
        deadline: p.deadline ? new Date(p.deadline) : null,
        checkItems,
        attachments,
        parentTaskId: null,
        crossProjects: [] as string[],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(tasks).values(newTask);
      eventBus.emit({ type: 'task_update', resourceId: newId });
      counts.created++;
    }
  }

  for (const [title, existing] of existingMap) {
    if (!parsedTitles.has(title) && existing.attachments?.includes(`sync:${documentId}`)) {
      await db.delete(tasks).where(eq(tasks.id, existing.id));
      eventBus.emit({ type: 'task_update', resourceId: existing.id });
      counts.deleted++;
    }
  }

  return { synced: true, type: 'teamclaw:tasks', counts };
}

function mergeCheckItems(existing: CheckItem[], parsed: CheckItem[]): CheckItem[] {
  return parsed.map(p => {
    const match = existing.find(e => e.text === p.text);
    return match ? { ...match, completed: p.completed } : p;
  });
}
