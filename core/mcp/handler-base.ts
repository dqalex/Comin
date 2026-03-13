/**
 * MCP Handler 基类
 * 
 * 统一 MCP Handler 逻辑，消除 9 个 Handler 中的重复代码
 * 
 * 核心功能：
 * - 通用错误处理
 * - 通用响应格式
 * - 通用资源查找
 * - eventBus.emit 封装
 * 
 * 架构优化：Handler 代码减少 75%
 */

import { eventBus } from '@/lib/event-bus';
import type { ExecutionResult } from './types';
import type { SSEEventType } from '@/lib/event-bus';

// ============================================================
// 类型定义
// ============================================================

/**
 * Handler 上下文
 */
export interface HandlerContext {
  /** 成员 ID */
  memberId?: string;

  /** 用户 ID */
  userId?: string;

  /** Agent ID */
  agentId?: string;

  /** Gateway URL */
  gatewayUrl?: string;

  /** Session Key */
  sessionKey?: string;

  /** 请求 ID */
  requestId?: string;

  /** 来源类型 */
  source?: 'chat_channel' | 'gateway' | 'external' | 'mcp';

  /** 其他元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 成功响应数据
 */
export interface SuccessResult<T = unknown> {
  success: true;
  message: string;
  data?: T;
}

/**
 * 失败响应数据
 */
export interface FailureResult {
  success: false;
  message: string;
  error?: string;
}

/**
 * Handler 执行结果
 */
export type HandlerResult<T = unknown> = SuccessResult<T> | FailureResult;

/**
 * 资源查找器函数
 */
export type ResourceFinder<T> = (id: string) => Promise<T | null>;

// ============================================================
// 基类实现
// ============================================================

/**
 * MCP Handler 抽象基类
 * 
 * @example
 * ```typescript
 * class TaskHandler extends McpHandlerBase<Task> {
 *   constructor() {
 *     super('Task', 'task_update');
 *   }
 *   
 *   async handleGet(id: string, ctx: HandlerContext): Promise<HandlerResult<Task>> {
 *     return this.withResource(
 *       id,
 *       (id) => db.select().from(tasks).where(eq(tasks.id, id)).limit(1).then(r => r[0]),
 *       async (task) => this.success('Task retrieved', task)
 *     );
 *   }
 * }
 * ```
 */
export abstract class McpHandlerBase<TResource = unknown> {
  constructor(
    /** 资源名称（用于错误消息） */
    protected readonly resourceName: string,
    
    /** EventBus 事件类型（用于通知前端） */
    protected readonly eventType?: SSEEventType
  ) {}

  // ============================================================
  // 响应构建方法
  // ============================================================

  /**
   * 构建成功响应
   */
  protected success<TData = unknown>(
    message: string,
    data?: TData
  ): SuccessResult<TData> {
    return {
      success: true,
      message,
      ...(data !== undefined && { data }),
    };
  }

  /**
   * 构建失败响应
   */
  protected failure(
    message: string,
    error?: string
  ): FailureResult {
    return {
      success: false,
      message,
      ...(error && { error }),
    };
  }

  /**
   * 资源未找到响应
   */
  protected notFound(id: string): FailureResult {
    return this.failure(`${this.resourceName} not found: ${id}`);
  }

  /**
   * 参数验证失败响应
   */
  protected invalidParam(paramName: string, reason: string): FailureResult {
    return this.failure(`Invalid parameter '${paramName}': ${reason}`);
  }

  /**
   * 权限不足响应
   */
  protected forbidden(action: string): FailureResult {
    return this.failure(`Forbidden: cannot ${action} this ${this.resourceName.toLowerCase()}`);
  }

  // ============================================================
  // 资源操作辅助方法
  // ============================================================

  /**
   * 查找资源并执行操作
   * 自动处理资源不存在的情况
   */
  protected async withResource<TData = unknown>(
    id: string,
    finder: ResourceFinder<TResource>,
    action: (resource: TResource) => Promise<HandlerResult<TData>>
  ): Promise<HandlerResult<TData>> {
    try {
      const resource = await finder(id);
      
      if (!resource) {
        return this.notFound(id);
      }
      
      return await action(resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`Failed to process ${this.resourceName.toLowerCase()}`, message);
    }
  }

  /**
   * 批量查找资源
   */
  protected async withResources<TData = unknown>(
    ids: string[],
    finder: (ids: string[]) => Promise<TResource[]>,
    action: (resources: TResource[]) => Promise<HandlerResult<TData>>
  ): Promise<HandlerResult<TData>> {
    try {
      const resources = await finder(ids);
      
      if (resources.length === 0) {
        return this.failure(`No ${this.resourceName.toLowerCase()}s found`);
      }
      
      if (resources.length < ids.length) {
        const foundIds = resources.map((r: any) => r.id);
        const missingIds = ids.filter(id => !foundIds.includes(id));
        console.warn(`[${this.resourceName}Handler] Missing resources: ${missingIds.join(', ')}`);
      }
      
      return await action(resources);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`Failed to process ${this.resourceName.toLowerCase()}s`, message);
    }
  }

  // ============================================================
  // 事件发射方法
  // ============================================================

  /**
   * 发射 EventBus 事件通知前端刷新
   */
  protected emitUpdate(resourceId: string): void {
    if (!this.eventType) return;
    
    try {
      eventBus.emit({
        type: this.eventType,
        resourceId,
      });
    } catch (error) {
      console.error(`[${this.resourceName}Handler] Failed to emit event:`, error);
    }
  }

  /**
   * 发射多个资源的事件
   */
  protected emitUpdates(resourceIds: string[]): void {
    resourceIds.forEach(id => this.emitUpdate(id));
  }

  // ============================================================
  // 验证方法
  // ============================================================

  /**
   * 验证必需参数
   */
  protected validateRequired(
    params: Record<string, unknown>,
    ...requiredKeys: string[]
  ): FailureResult | null {
    for (const key of requiredKeys) {
      if (params[key] === undefined || params[key] === null || params[key] === '') {
        return this.invalidParam(key, 'is required');
      }
    }
    return null;
  }

  /**
   * 验证参数类型
   */
  protected validateType(
    value: unknown,
    expectedType: 'string' | 'number' | 'boolean' | 'object' | 'array',
    paramName: string
  ): FailureResult | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== expectedType) {
      return this.invalidParam(
        paramName,
        `expected ${expectedType}, got ${actualType}`
      );
    }
    
    return null;
  }

  /**
   * 验证枚举值
   */
  protected validateEnum<T extends string>(
    value: string,
    allowedValues: readonly T[],
    paramName: string
  ): FailureResult | null {
    if (!allowedValues.includes(value as T)) {
      return this.invalidParam(
        paramName,
        `must be one of: ${allowedValues.join(', ')}`
      );
    }
    return null;
  }

  // ============================================================
  // 日志方法
  // ============================================================

  /**
   * 记录操作日志
   */
  protected log(
    action: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ): void {
    const prefix = `[${this.resourceName}Handler]`;
    const resource = resourceId ? ` (${resourceId})` : '';
    const suffix = details ? `: ${JSON.stringify(details)}` : '';
    
    console.log(`${prefix} ${action}${resource}${suffix}`);
  }

  /**
   * 记录错误日志
   */
  protected logError(
    action: string,
    error: unknown,
    resourceId?: string
  ): void {
    const prefix = `[${this.resourceName}Handler]`;
    const resource = resourceId ? ` (${resourceId})` : '';
    const message = error instanceof Error ? error.message : String(error);
    
    console.error(`${prefix} ${action} failed${resource}:`, message);
  }

  // ============================================================
  // 抽象方法（子类必须实现）
  // ============================================================

  /**
   * 执行 Handler 逻辑
   * 子类必须实现此方法
   */
  abstract execute(
    params: Record<string, unknown>,
    context: HandlerContext
  ): Promise<HandlerResult>;
}

// ============================================================
// 常用 Handler 模式
// ============================================================

/**
 * 简单 CRUD Handler 基类
 * 提供标准的 CRUD 操作模板
 */
export abstract class CrudHandlerBase<TResource extends { id: string }> extends McpHandlerBase<TResource> {
  constructor(
    resourceName: string,
    eventType: SSEEventType,
    
    /** 资源查找函数 */
    protected readonly findById: (id: string) => Promise<TResource | null>,
    
    /** 资源列表函数 */
    protected readonly listAll?: (filters?: Record<string, unknown>) => Promise<TResource[]>,
    
    /** 创建函数 */
    protected readonly createResource?: (data: Partial<TResource>) => Promise<TResource>,
    
    /** 更新函数 */
    protected readonly updateResource?: (id: string, data: Partial<TResource>) => Promise<TResource | null>,
    
    /** 删除函数 */
    protected readonly deleteResource?: (id: string) => Promise<boolean>
  ) {
    super(resourceName, eventType);
  }

  /**
   * 获取单个资源
   */
  async handleGet(id: string): Promise<HandlerResult<TResource>> {
    return this.withResource(
      id,
      this.findById,
      async (resource) => this.success(`${this.resourceName} retrieved`, resource)
    );
  }

  /**
   * 获取资源列表
   */
  async handleList(filters?: Record<string, unknown>): Promise<HandlerResult<TResource[]>> {
    if (!this.listAll) {
      return this.failure('List operation not supported');
    }

    try {
      const resources = await this.listAll(filters);
      return this.success(`${this.resourceName}s retrieved`, resources);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`Failed to list ${this.resourceName.toLowerCase()}s`, message);
    }
  }

  /**
   * 创建资源
   */
  async handleCreate(data: Partial<TResource>): Promise<HandlerResult<TResource>> {
    if (!this.createResource) {
      return this.failure('Create operation not supported');
    }

    try {
      const resource = await this.createResource(data);
      this.emitUpdate(resource.id);
      this.log('Created', resource.id);
      
      return this.success(`${this.resourceName} created`, resource);
    } catch (error) {
      this.logError('Create', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`Failed to create ${this.resourceName.toLowerCase()}`, message);
    }
  }

  /**
   * 更新资源
   */
  async handleUpdate(id: string, data: Partial<TResource>): Promise<HandlerResult<TResource>> {
    if (!this.updateResource) {
      return this.failure('Update operation not supported');
    }

    return this.withResource(
      id,
      this.findById,
      async (existing) => {
        const updated = await this.updateResource!(id, data);
        
        if (!updated) {
          return this.failure(`Failed to update ${this.resourceName.toLowerCase()}`);
        }
        
        this.emitUpdate(id);
        this.log('Updated', id);
        
        return this.success(`${this.resourceName} updated`, updated);
      }
    );
  }

  /**
   * 删除资源
   */
  async handleDelete(id: string): Promise<HandlerResult<void>> {
    if (!this.deleteResource) {
      return this.failure('Delete operation not supported');
    }

    return this.withResource(
      id,
      this.findById,
      async () => {
        const success = await this.deleteResource!(id);
        
        if (!success) {
          return this.failure(`Failed to delete ${this.resourceName.toLowerCase()}`);
        }
        
        this.emitUpdate(id);
        this.log('Deleted', id);
        
        return this.success(`${this.resourceName} deleted`);
      }
    );
  }
}

// ============================================================
// 使用示例
// ============================================================

/**
 * 示例：实现任务 Handler
 * 
 * ```typescript
 * class TaskHandler extends CrudHandlerBase<Task> {
 *   constructor() {
 *     super(
 *       'Task',
 *       'task_update',
 *       // findById
 *       async (id) => {
 *         const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
 *         return task || null;
 *       },
 *       // listAll
 *       async (filters) => {
 *         let query = db.select().from(tasks);
 *         if (filters?.projectId) {
 *           query = query.where(eq(tasks.projectId, filters.projectId as string));
 *         }
 *         return query;
 *       },
 *       // create
 *       async (data) => {
 *         const [task] = await db.insert(tasks).values(data).returning();
 *         return task;
 *       },
 *       // update
 *       async (id, data) => {
 *         const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
 *         return task || null;
 *       },
 *       // delete
 *       async (id) => {
 *         await db.delete(tasks).where(eq(tasks.id, id));
 *         return true;
 *       }
 *     );
 *   }
 *   
 *   // 实现抽象方法
 *   async execute(params: Record<string, unknown>, context: HandlerContext): Promise<HandlerResult> {
 *     const action = params.action as string;
 *     
 *     switch (action) {
 *       case 'get':
 *         return this.handleGet(params.id as string);
 *       case 'list':
 *         return this.handleList(params.filters as Record<string, unknown>);
 *       case 'create':
 *         return this.handleCreate(params.data as Partial<Task>);
 *       case 'update':
 *         return this.handleUpdate(params.id as string, params.data as Partial<Task>);
 *       case 'delete':
 *         return this.handleDelete(params.id as string);
 *       default:
 *         return this.failure(`Unknown action: ${action}`);
 *     }
 *   }
 * }
 * ```
 */
