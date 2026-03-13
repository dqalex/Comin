/**
 * Workspace 服务 - 渐进式上下文管理
 * 
 * 负责：
 * 1. .context/ 目录结构管理
 * 2. 心跳自检机制
 * 3. L1 索引文件生成
 * 4. L2 详情文件按需生成
 */

import { mkdir, writeFile, readFile, access, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// 类型定义
// ============================================================================

export interface Heartbeat {
  timestamp: string;
  sessionId: string;
  status: 'active' | 'inactive';
  lastPing: string;
}

export interface WorkspaceIndex {
  generatedAt: string;
  tasks: Array<{ id: string; title: string; status: string }>;
  projects: Array<{ id: string; name: string }>;
}

export type ContextType = 
  | 'task_detail'
  | 'task_comments'
  | 'project_detail'
  | 'document_content'
  | 'sop_previous_output'
  | 'sop_knowledge_layer';

export interface ContextRequest {
  type: ContextType;
  params: Record<string, string>;
}

export interface ContextResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// 常量
// ============================================================================

const CONTEXT_DIR = '.context';
const HEARTBEAT_FILE = 'heartbeat.json';
const INDEX_FILE = 'index.md';
const HEARTBEAT_TIMEOUT_MS = 60 * 1000; // 1 分钟超时

// ============================================================================
// 目录结构
// ============================================================================

/**
 * 获取 .context 目录路径
 */
export function getContextDir(basePath: string = process.cwd()): string {
  return join(basePath, CONTEXT_DIR);
}

/**
 * 初始化 .context 目录结构
 */
export async function initContextDir(basePath: string = process.cwd()): Promise<void> {
  const contextDir = getContextDir(basePath);
  
  const subdirs = [
    'sop',
    'sop/previous-outputs',
    'sop/knowledge',
    'tasks',
    'projects',
    'documents',
  ];
  
  for (const subdir of subdirs) {
    const dir = join(contextDir, subdir);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

// ============================================================================
// 心跳机制
// ============================================================================

/**
 * 写入心跳文件
 */
export async function writeHeartbeat(
  sessionId: string,
  basePath: string = process.cwd()
): Promise<void> {
  const contextDir = getContextDir(basePath);
  
  if (!existsSync(contextDir)) {
    await initContextDir(basePath);
  }
  
  const heartbeat: Heartbeat = {
    timestamp: new Date().toISOString(),
    sessionId,
    status: 'active',
    lastPing: new Date().toISOString(),
  };
  
  await writeFile(
    join(contextDir, HEARTBEAT_FILE),
    JSON.stringify(heartbeat, null, 2),
    'utf-8'
  );
}

/**
 * 检查心跳是否活跃
 */
export async function isWorkspaceActive(
  sessionId: string,
  basePath: string = process.cwd()
): Promise<boolean> {
  const contextDir = getContextDir(basePath);
  const heartbeatPath = join(contextDir, HEARTBEAT_FILE);
  
  try {
    await access(heartbeatPath);
    const content = await readFile(heartbeatPath, 'utf-8');
    const heartbeat = JSON.parse(content) as Heartbeat;
    
    // 检查是否匹配 session 且未超时
    const lastPing = new Date(heartbeat.lastPing).getTime();
    const now = Date.now();
    const isRecent = (now - lastPing) < HEARTBEAT_TIMEOUT_MS;
    
    return heartbeat.sessionId === sessionId && 
           heartbeat.status === 'active' && 
           isRecent;
  } catch {
    return false;
  }
}

/**
 * 清除心跳（标记为 inactive）
 */
export async function clearHeartbeat(basePath: string = process.cwd()): Promise<void> {
  const contextDir = getContextDir(basePath);
  const heartbeatPath = join(contextDir, HEARTBEAT_FILE);
  
  try {
    const content = await readFile(heartbeatPath, 'utf-8');
    const heartbeat = JSON.parse(content) as Heartbeat;
    heartbeat.status = 'inactive';
    await writeFile(heartbeatPath, JSON.stringify(heartbeat, null, 2), 'utf-8');
  } catch {
    // 文件不存在，忽略
  }
}

// ============================================================================
// L1 索引文件生成
// ============================================================================

/**
 * 生成任务 L1 索引文件
 */
export async function generateTaskIndex(
  task: { id: string; title: string; status: string; priority: string },
  basePath: string = process.cwd()
): Promise<string> {
  const contextDir = getContextDir(basePath);
  const taskDir = join(contextDir, 'tasks', task.id);
  
  if (!existsSync(taskDir)) {
    await mkdir(taskDir, { recursive: true });
  }
  
  const content = `# 任务索引: ${task.title}

| 属性 | 值 |
|------|-----|
| ID | ${task.id} |
| 状态 | ${task.status} |
| 优先级 | ${task.priority} |
| 生成时间 | ${new Date().toLocaleString('zh-CN')} |

## 可用详情文件
- \`detail.md\` - 完整任务详情（需请求生成）

## 获取详情
通过 MCP 工具: \`get_task(task_id="${task.id}", detail=true)\`
通过对话信道: 回复 "请求上下文: - 类型: task_detail - 参数: { task_id: "${task.id}" }"
`;
  
  const indexPath = join(taskDir, INDEX_FILE);
  await writeFile(indexPath, content, 'utf-8');
  
  return indexPath;
}

/**
 * 生成 SOP 当前阶段 L1 索引
 */
export async function generateSOPStageIndex(
  task: { id: string; title: string },
  stage: { id: string; label: string; type: string },
  basePath: string = process.cwd()
): Promise<string> {
  const contextDir = getContextDir(basePath);
  const sopDir = join(contextDir, 'sop');
  
  if (!existsSync(sopDir)) {
    await mkdir(sopDir, { recursive: true });
  }
  
  const content = `# SOP 当前阶段

| 属性 | 值 |
|------|-----|
| 任务 ID | ${task.id} |
| 任务标题 | ${task.title} |
| 当前阶段 | ${stage.label} |
| 阶段类型 | ${stage.type} |
| 生成时间 | ${new Date().toLocaleString('zh-CN')} |

## 可用详情文件
- \`previous-outputs/\` - 前序阶段产出目录
- \`knowledge/\` - 知识库层级目录

## 获取详情
通过 MCP 工具: \`get_sop_context(task_id="${task.id}")\`
通过对话信道: 回复 "请求上下文: - 类型: sop_previous_output - 参数: { task_id: "${task.id}" }"
`;
  
  const indexPath = join(sopDir, 'current-stage.md');
  await writeFile(indexPath, content, 'utf-8');
  
  return indexPath;
}

// ============================================================================
// L2 详情文件生成
// ============================================================================

/**
 * 生成任务 L2 详情文件
 */
export async function generateTaskDetail(
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    deadline: number | null;
    assignees: string[] | null;
    checkItems: unknown;
  },
  comments: Array<{ author: string; content: string; createdAt: string }>,
  basePath: string = process.cwd()
): Promise<string> {
  const contextDir = getContextDir(basePath);
  const taskDir = join(contextDir, 'tasks', task.id);
  
  if (!existsSync(taskDir)) {
    await mkdir(taskDir, { recursive: true });
  }
  
  const checkItems = (task.checkItems as Array<{ text: string; completed: boolean }>) || [];
  const checkItemsMd = checkItems.length > 0
    ? checkItems.map(item => `- [${item.completed ? 'x' : ' '}] ${item.text}`).join('\n')
    : '（无检查项）';
  
  const commentsMd = comments.length > 0
    ? comments.map(c => `- **${c.author}** (${c.createdAt}): ${c.content}`).join('\n')
    : '（无评论）';
  
  const content = `# 任务详情: ${task.title}

## 基本信息

| 属性 | 值 |
|------|-----|
| ID | ${task.id} |
| 状态 | ${task.status} |
| 优先级 | ${task.priority} |
| 截止时间 | ${task.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : '未设置'} |
| 负责人 | ${task.assignees?.join(', ') || '未指定'} |

## 描述

${task.description || '无描述'}

## 检查项

${checkItemsMd}

## 评论历史

${commentsMd}

---
生成时间: ${new Date().toLocaleString('zh-CN')}
`;
  
  const detailPath = join(taskDir, 'detail.md');
  await writeFile(detailPath, content, 'utf-8');
  
  return detailPath;
}

// ============================================================================
// 心跳内存缓存（避免频繁文件读取）
// ============================================================================

const heartbeatCache = new Map<string, { active: boolean; timestamp: number }>();
const CACHE_TTL_MS = 10 * 1000; // 10 秒缓存

/**
 * 带缓存的心跳检查
 */
export function isWorkspaceActiveCached(sessionId: string): boolean {
  const cached = heartbeatCache.get(sessionId);
  if (cached) {
    const now = Date.now();
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.active;
    }
  }
  
  // 异步更新缓存，返回 false（保守处理）
  isWorkspaceActive(sessionId).then(active => {
    heartbeatCache.set(sessionId, { active, timestamp: Date.now() });
  });
  
  return cached?.active ?? false;
}

/**
 * 清除心跳缓存
 */
export function clearHeartbeatCache(sessionId: string): void {
  heartbeatCache.delete(sessionId);
}
