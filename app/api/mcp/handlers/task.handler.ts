/**
 * MCP Handler: 任务操作
 * 
 * 重构后：使用 McpHandlerBase 基类，代码量减少约 60%
 */

import { db } from '@/db';
import { tasks, comments, taskLogs, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateLogId, generateCommentId, generateCheckItemId } from '@/lib/id';
import { triggerMarkdownSync } from '@/lib/markdown-sync';
import { McpHandlerBase, type HandlerContext, type HandlerResult } from '@/core/mcp/handler-base';
import type { Task, CheckItem } from '@/db/schema';

/** 获取 TeamClaw 基础 URL */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/** 构建任务访问链接 */
function buildTaskUrl(taskId: string): string {
  return `${getBaseUrl()}/tasks?task=${taskId}`;
}

/** 任务列表查询参数 */
interface ListMyTasksParams {
  member_id?: string;
  member_name?: string;
  status?: 'todo' | 'in_progress' | 'reviewing' | 'completed' | 'all';
  project_id?: string;
  limit?: number;
  detail?: boolean; // 渐进式上下文：是否返回完整详情
}

/**
 * Task Handler - 继承 McpHandlerBase 基类
 */
class TaskHandler extends McpHandlerBase<Task> {
  constructor() {
    super('Task', 'task_update');
  }

  /**
   * 主入口 - 调度各个具体处理方法
   */
  async execute(
    params: Record<string, unknown>,
    _context: HandlerContext
  ): Promise<HandlerResult> {
    const action = params.action as string;

    switch (action) {
      case 'get':
        return this.handleGetTask(params);
      case 'update_status':
        return this.handleUpdateTaskStatus(params);
      case 'add_comment':
        return this.handleAddTaskComment(params);
      case 'create_check_item':
        return this.handleCreateCheckItem(params);
      case 'complete_check_item':
        return this.handleCompleteCheckItem(params);
      case 'list_my_tasks':
        return this.handleListMyTasks(params);
      default:
        return this.failure(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取任务详情
   * 
   * 渐进式上下文设计：
   * - detail=false（默认）：返回 L1 索引（精简数据）
   * - detail=true：返回 L2 完整详情
   */
  private async handleGetTask(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id');
    if (validation) return validation;

    const { task_id, detail = false } = params as { task_id: string; detail?: boolean };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        // L1 索引：精简数据，节省上下文
        if (!detail) {
          return this.success('Task index retrieved', {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            projectId: task.projectId,
            deadline: task.deadline,
            assignees: task.assignees,
            url: buildTaskUrl(task.id),
          });
        }
        
        // L2 详情：完整数据
        return this.success('Task detail retrieved', {
          ...task,
          url: buildTaskUrl(task.id),
        });
      }
    );
  }

  /**
   * 更新任务状态
   */
  private async handleUpdateTaskStatus(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'status');
    if (validation) return validation;

    const { task_id, status, progress, message } = params as {
      task_id: string;
      status: 'todo' | 'in_progress' | 'reviewing' | 'completed';
      progress?: number;
      message?: string;
    };

    // 验证 status 枚举值
    const statusValidation = this.validateEnum(status, 
      ['todo', 'in_progress', 'reviewing', 'completed'] as const, 
      'status'
    );
    if (statusValidation) return statusValidation;

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
        if (progress !== undefined) {
          updateData.progress = progress;
        }
        await db.update(tasks).set(updateData).where(eq(tasks.id, task_id));

        // 添加日志
        if (message) {
          await db.insert(taskLogs).values({
            id: generateLogId(),
            taskId: task_id,
            action: `status_change:${status}`,
            message,
            timestamp: new Date(),
          });
        }

        this.emitUpdate(task_id);
        triggerMarkdownSync('teamclaw:tasks');
        this.log('Status updated', task_id, { status, progress });

        return this.success('Status updated', { task_id, status, progress, message });
      }
    );
  }

  /**
   * 添加任务评论
   */
  private async handleAddTaskComment(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'content');
    if (validation) return validation;

    const { task_id, content, member_id } = params as { 
      task_id: string; 
      content: string; 
      member_id?: string;
    };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        // 优先使用调用方提供的 member_id，否则回退到 'ai-agent'
        const commentMemberId = member_id || 'ai-agent';
        const comment = {
          id: generateCommentId(),
          taskId: task_id,
          memberId: commentMemberId,
          content,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.insert(comments).values(comment);

        this.emitUpdate(task_id);
        this.log('Comment added', task_id);

        return this.success('Comment added', { comment });
      }
    );
  }

  /**
   * 创建检查项
   */
  private async handleCreateCheckItem(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'text');
    if (validation) return validation;

    const { task_id, text } = params as { task_id: string; text: string };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        const newItem: CheckItem = { 
          id: generateCheckItemId(), 
          text, 
          completed: false,
          source: 'manual'
        };
        const checkItems = task.checkItems || [];
        await db.update(tasks).set({
          checkItems: [...checkItems, newItem],
          updatedAt: new Date()
        }).where(eq(tasks.id, task_id));

        this.emitUpdate(task_id);
        triggerMarkdownSync('teamclaw:tasks');
        this.log('Check item created', task_id, { itemId: newItem.id });

        return this.success('Check item created', { item: newItem });
      }
    );
  }

  /**
   * 完成检查项
   */
  private async handleCompleteCheckItem(params: Record<string, unknown>): Promise<HandlerResult> {
    const validation = this.validateRequired(params, 'task_id', 'item_id');
    if (validation) return validation;

    const { task_id, item_id } = params as { task_id: string; item_id: string };

    return this.withResource(
      task_id,
      async (id) => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || null;
      },
      async (task) => {
        const checkItems = task.checkItems || [];
        const itemExists = checkItems.some(item => item.id === item_id);
        
        if (!itemExists) {
          return this.failure(`Check item not found: ${item_id}`);
        }

        const updatedItems = checkItems.map(item =>
          item.id === item_id ? { ...item, completed: true } : item
        );
        await db.update(tasks).set({
          checkItems: updatedItems,
          updatedAt: new Date()
        }).where(eq(tasks.id, task_id));

        this.emitUpdate(task_id);
        triggerMarkdownSync('teamclaw:tasks');
        this.log('Check item completed', task_id, { itemId: item_id });

        return this.success('Check item completed', { item_id });
      }
    );
  }

  /**
   * 获取分配给当前成员的任务列表
   * 
   * 渐进式上下文设计：
   * - detail=false（默认）：返回 L1 索引（精简数据）
   * - detail=true：返回 L2 完整详情
   */
  private async handleListMyTasks(params: Record<string, unknown>): Promise<HandlerResult> {
    const { member_id, member_name, status, project_id, limit = 20, detail = false } = params as ListMyTasksParams;

    // 解析成员身份：优先 member_id，其次 member_name（按昵称查找）
    let resolvedMemberId = member_id;
    if (!resolvedMemberId && member_name) {
      const allMembers = await db.select({ id: members.id, name: members.name })
        .from(members);
      const matched = allMembers.find(m => m.name === member_name);
      if (matched) {
        resolvedMemberId = matched.id;
      } else {
        return this.failure(`Member "${member_name}" not found`);
      }
    }

    try {
      // 获取所有任务后在内存中过滤（因为 assignees 是 JSON 数组）
      const allTasks = await db.select().from(tasks);

      let filteredTasks = allTasks;

      // 按成员过滤（如果提供了 member_id 或 member_name 解析结果）
      if (resolvedMemberId) {
        filteredTasks = filteredTasks.filter(t => {
          const assignees = t.assignees || [];
          return assignees.includes(resolvedMemberId!);
        });
      }

      // 按状态过滤
      if (status && status !== 'all') {
        const statusValidation = this.validateEnum(status,
          ['todo', 'in_progress', 'reviewing', 'completed'] as const,
          'status'
        );
        if (statusValidation) return statusValidation;
        filteredTasks = filteredTasks.filter(t => t.status === status);
      }

      // 按项目过滤
      if (project_id) {
        filteredTasks = filteredTasks.filter(t => t.projectId === project_id);
      }

      // 排序：优先级高的在前，同优先级按创建时间排序
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      filteredTasks.sort((a, b) => {
        const pa = priorityOrder[a.priority || 'medium'] ?? 1;
        const pb = priorityOrder[b.priority || 'medium'] ?? 1;
        if (pa !== pb) return pa - pb;
        return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
      });

      // 限制返回数量
      const limitedTasks = filteredTasks.slice(0, limit as number);

      // 格式化返回数据（根据 detail 参数分层）
      const result = limitedTasks.map(t => {
        // L1 索引：精简数据
        const l1Data = {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          projectId: t.projectId,
          deadline: t.deadline,
          url: buildTaskUrl(t.id),
        };
        
        // L2 详情：完整数据
        if (detail) {
          return {
            ...l1Data,
            description: t.description,
            assignees: t.assignees,
            checkItems: t.checkItems,
            progress: t.progress,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          };
        }
        
        return l1Data;
      });

      this.log('Listed tasks', undefined, { 
        total: filteredTasks.length, 
        returned: result.length,
        memberId: resolvedMemberId 
      });

      return this.success('Tasks retrieved', {
        tasks: result,
        total: filteredTasks.length,
        returned: result.length,
      });
    } catch (error) {
      this.logError('List tasks', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure('Failed to list tasks', message);
    }
  }
}

// 导出单例
export const taskHandler = new TaskHandler();

// 为了保持向后兼容，保留原有的函数导出
export async function handleGetTask(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'get' }, {});
}

export async function handleUpdateTaskStatus(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'update_status' }, {});
}

export async function handleAddTaskComment(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'add_comment' }, {});
}

export async function handleCreateCheckItem(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'create_check_item' }, {});
}

export async function handleCompleteCheckItem(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'complete_check_item' }, {});
}

export async function handleListMyTasks(params: Record<string, unknown>) {
  return taskHandler.execute({ ...params, action: 'list_my_tasks' }, {});
}
