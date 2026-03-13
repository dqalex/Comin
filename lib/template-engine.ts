/**
 * TeamClaw 模板引擎
 * 
 * 负责：
 * 1. 从 public/skills/templates/ 读取 Markdown 模板
 * 2. 从数据库动态获取系统信息（成员、项目、智能体等）
 * 3. 渲染模板变量（Mustache 风格 {{variable}}）
 * 4. 提供 API 供 Skill / 推送 / 聊天上下文使用
 */

import { db } from '@/db';
import { members, projects, tasks } from '@/db/schema';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { APP_VERSION } from '@/lib/version';

// ==================== 类型定义 ====================

export interface SystemContext {
  // 成员信息
  human_members: MemberInfo[];
  ai_members: AIMemberInfo[];
  all_members: MemberInfo[];
  
  // 项目信息
  projects: ProjectInfo[];
  
  // 运行时信息
  teamclaw_base_url: string;
  current_date: string;
  current_time: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  type: 'human' | 'ai';
  online: boolean;
}

export interface AIMemberInfo extends MemberInfo {
  deploy_mode: string | null;
  endpoint: string | null;
  execution_mode: string;
  connection_status: string | null;
  tools: string[];
  task_types: string[];
  model: string | null;
  // 负责的项目
  assigned_projects: string[];
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  task_count: number;
  task_summary: { todo: number; in_progress: number; reviewing: number; completed: number };
  assigned_members: string[]; // 成员名
}

// ==================== 模板缓存 ====================

const templateCache = new Map<string, { content: string; mtime: number }>();
const TEMPLATE_DIR = join(process.cwd(), 'public/skills/templates');

// ==================== 系统上下文获取 ====================

/** 从数据库获取完整的系统上下文 */
export async function getSystemContext(): Promise<SystemContext> {
  const [allMembers, allProjects, allTasks] = await Promise.all([
    db.select().from(members),
    db.select().from(projects),
    db.select().from(tasks),
  ]);

  const humanMembers = allMembers.filter(m => m.type === 'human');
  const aiMembers = allMembers.filter(m => m.type === 'ai');

  // 构建 AI 成员信息（含负责项目）
  const aiMemberInfos: AIMemberInfo[] = aiMembers.map(m => {
    const assignedTaskProjectIds = new Set(
      allTasks.filter(t => {
        const taskAssignees = t.assignees || [];
        return taskAssignees.includes(m.id) && t.projectId;
      }).map(t => t.projectId!)
    );
    const assignedProjects = allProjects
      .filter(p => assignedTaskProjectIds.has(p.id))
      .map(p => p.name);

    return {
      id: m.id,
      name: m.name,
      type: 'ai' as const,
      online: m.online ?? false,
      deploy_mode: m.openclawDeployMode || null,
      endpoint: m.openclawEndpoint || null,
      execution_mode: m.executionMode || 'chat_only',
      connection_status: m.openclawConnectionStatus || null,
      tools: m.experienceTools || [],
      task_types: m.experienceTaskTypes || [],
      model: m.openclawModel || null,
      assigned_projects: assignedProjects,
    };
  });

  // 构建项目信息
  const projectInfos: ProjectInfo[] = allProjects.map(p => {
    const projectTasks = allTasks.filter(t => t.projectId === p.id);
    const assigneeIds = new Set(projectTasks.flatMap(t => t.assignees || []));
    const assignedMembers = allMembers
      .filter(m => assigneeIds.has(m.id))
      .map(m => m.name);

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      task_count: projectTasks.length,
      task_summary: {
        todo: projectTasks.filter(t => t.status === 'todo').length,
        in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
        reviewing: projectTasks.filter(t => t.status === 'reviewing').length,
        completed: projectTasks.filter(t => t.status === 'completed').length,
      },
      assigned_members: assignedMembers,
    };
  });

  return {
    human_members: humanMembers.map(m => ({
      id: m.id,
      name: m.name,
      type: 'human' as const,
      online: m.online ?? false,
    })),
    ai_members: aiMemberInfos,
    all_members: allMembers.map(m => ({
      id: m.id,
      name: m.name,
      type: m.type as 'human' | 'ai',
      online: m.online ?? false,
    })),
    projects: projectInfos,
    teamclaw_base_url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    current_date: new Date().toLocaleDateString('zh-CN'),
    current_time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  };
}

// ==================== 模板读取 ====================

/** 读取模板文件（带缓存） */
export function readTemplate(templateName: string): string | null {
  const filePath = join(TEMPLATE_DIR, `${templateName}.md`);
  
  if (!existsSync(filePath)) {
    return null;
  }

  // 开发环境不缓存，生产环境缓存
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    const cached = templateCache.get(templateName);
    if (cached) return cached.content;
  }

  const content = readFileSync(filePath, 'utf-8');
  templateCache.set(templateName, { content, mtime: Date.now() });
  return content;
}

/** 列出所有可用模板 */
export function listTemplates(): { name: string; title: string; description: string; teamclaw_version: string }[] {
  if (!existsSync(TEMPLATE_DIR)) return [];
  
  const files = readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const name = f.replace('.md', '');
    const content = readTemplate(name);
    // 从 frontmatter 提取 title 和 description
    const meta = parseFrontmatter(content || '');
    return {
      name,
      title: meta.title || name,
      description: meta.description || '',
      teamclaw_version: meta.teamclaw_version || APP_VERSION,
    };
  });
}

// ==================== 模板渲染 ====================

/** 简易 frontmatter 解析 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const teamclawVersion = APP_VERSION;
  const meta: Record<string, string> = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      let value = rest.join(':').trim();
      // 替换版本号变量
      if (value === '"{{teamclaw_version}}"') {
        value = teamclawVersion;
      }
      meta[key.trim()] = value;
    }
  });
  return meta;
}

/** 移除 frontmatter */
function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '');
}

/**
 * 渲染模板：替换 {{variable}} 占位符
 * 
 * 支持的语法：
 * - {{variable}} — 简单替换
 * - {{#section}}...{{/section}} — 条件/循环块（支持嵌套）
 * - {{member.field}} — 嵌套属性
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  const stripped = stripFrontmatter(template);
  return renderBlock(stripped, context);
}

/** 渲染模板块（不含 frontmatter 处理，支持递归调用） */
function renderBlock(template: string, context: Record<string, unknown>): string {
  let result = template;

  // 循环处理直到没有更多条件块（支持嵌套）
  let previousResult = '';
  let iterations = 0;
  const maxIterations = 10; // 防止无限循环
  
  while (previousResult !== result && iterations < maxIterations) {
    previousResult = result;
    iterations++;
    
    // 1. 处理条件/循环块 {{#key}}...{{/key}}
    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, block) => {
      const value = context[key];
      if (Array.isArray(value)) {
        // 循环块：将 item 字段合并到 context 后递归渲染
        return value.map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            // 合并 item 字段到上下文（item 字段优先）
            const itemContext: Record<string, unknown> = { ...context, ...item, '@index': index, '@number': index + 1 };
            return renderBlock(block, itemContext);
          } else {
            // 简单值数组
            let rendered = block;
            rendered = rendered.replace(/\{\{\.\}\}/g, String(item));
            rendered = rendered.replace(/\{\{@index\}\}/g, String(index));
            rendered = rendered.replace(/\{\{@number\}\}/g, String(index + 1));
            return rendered;
          }
        }).join('');
      }
      // 条件块：truthy 则显示内容
      if (value) return block;
      return '';
    });

    // 2. 处理反向条件块 {{^key}}...{{/key}}
    result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, block) => {
      const value = context[key];
      if (!value || (Array.isArray(value) && value.length === 0)) return block;
      return '';
    });
  }

  // 3. 处理嵌套属性 {{a.b.c}}、简单变量 {{key}}、循环体内 {{.field}}
  result = result.replace(/\{\{(\.?[\w.]+)\}\}/g, (match, path: string) => {
    // 处理 {{.field}} 格式：去掉前导 . 直接在 context 中查找
    const cleanPath = path.startsWith('.') ? path.slice(1) : path;
    if (!cleanPath) return '';
    const parts = cleanPath.split('.');
    let value: unknown = context;
    for (const part of parts) {
      if (value == null || typeof value !== 'object') return '';
      value = (value as Record<string, unknown>)[part];
    }
    if (value === undefined || value === null) return '';
    return formatValue(value);
  });

  return result;
}

/** 格式化值为字符串 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ==================== 高级 API ====================

/**
 * 渲染指定模板（带系统上下文）
 * 
 * @param templateName 模板名称（不含 .md 扩展名）
 * @param extraContext 额外上下文变量（可覆盖系统变量）
 */
export async function renderTemplateWithContext(
  templateName: string,
  extraContext?: Record<string, unknown>
): Promise<string | null> {
  const template = readTemplate(templateName);
  if (!template) return null;

  const sysCtx = await getSystemContext();
  
  // 将 SystemContext 展平为模板变量
  const flatContext: Record<string, unknown> = {
    ...flattenSystemContext(sysCtx),
    ...extraContext,
  };

  return renderTemplate(template, flatContext);
}

/** 将 SystemContext 展平为模板引擎可用的变量 */
function flattenSystemContext(ctx: SystemContext): Record<string, unknown> {
  return {
    // 成员列表
    human_members: ctx.human_members,
    ai_members: ctx.ai_members,
    all_members: ctx.all_members,
    
    // 项目列表
    projects: ctx.projects,
    
    // 运行时
    teamclaw_base_url: ctx.teamclaw_base_url,
    teamclaw_version: APP_VERSION,
    current_date: ctx.current_date,
    current_time: ctx.current_time,
    
    // 便捷变量
    human_member_names: ctx.human_members.map(m => m.name).join(', '),
    ai_member_names: ctx.ai_members.map(m => m.name).join(', '),
    project_names: ctx.projects.map(p => p.name).join(', '),
    member_count: ctx.all_members.length,
    project_count: ctx.projects.length,
  };
}

/**
 * 获取完整的系统信息 Markdown（供 Skill 模板引用）
 * 
 * 直接渲染 system-info 模板，包含所有成员、项目、智能体信息
 */
export async function getSystemInfoMarkdown(): Promise<string> {
  const result = await renderTemplateWithContext('system-info');
  if (result) return result;
  
  // Fallback: 如果模板不存在，动态生成
  const ctx = await getSystemContext();
  return generateFallbackSystemInfo(ctx);
}

/** 模板不存在时的 Fallback */
function generateFallbackSystemInfo(ctx: SystemContext): string {
  let md = `# TeamClaw 系统信息\n\n`;
  md += `> 生成时间：${ctx.current_date} ${ctx.current_time}\n\n`;

  md += `## 团队成员\n\n`;
  md += `### 人类成员\n`;
  ctx.human_members.forEach(m => {
    md += `- **${m.name}** (ID: ${m.id})\n`;
  });

  md += `\n### AI 智能体\n`;
  ctx.ai_members.forEach(m => {
    md += `- **${m.name}** (ID: ${m.id})\n`;
    md += `  - 部署模式: ${m.deploy_mode || '未配置'}\n`;
    md += `  - 执行模式: ${m.execution_mode}\n`;
    md += `  - 连接状态: ${m.connection_status || '未知'}\n`;
    if (m.model) md += `  - 模型: ${m.model}\n`;
    if (m.tools.length > 0) md += `  - 擅长工具: ${m.tools.join(', ')}\n`;
    if (m.task_types.length > 0) md += `  - 任务类型: ${m.task_types.join(', ')}\n`;
    if (m.assigned_projects.length > 0) {
      md += `  - 参与项目: ${m.assigned_projects.join(', ')}\n`;
    }
  });

  md += `\n## 项目列表\n\n`;
  ctx.projects.forEach(p => {
    const s = p.task_summary;
    md += `### ${p.name}\n`;
    if (p.description) md += `${p.description}\n`;
    md += `- ID: ${p.id}\n`;
    md += `- 任务: ${p.task_count} 个（待办 ${s.todo} / 进行中 ${s.in_progress} / 审核中 ${s.reviewing} / 已完成 ${s.completed}）\n`;
    md += `- 成员: ${p.assigned_members.join(', ') || '无'}\n\n`;
  });

  return md;
}
