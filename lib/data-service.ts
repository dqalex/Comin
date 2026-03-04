/**
 * 数据访问层抽象
 */

import type { 
  Project, Task, Member, Document,
  NewProject, NewTask, NewMember, NewDocument,
  OpenClawStatus, NewOpenClawStatus,
  ScheduledTask, NewScheduledTask,
  ScheduledTaskHistory,
  Delivery, NewDelivery,
  Milestone, NewMilestone,
  Comment,
  TaskLog,
  SOPTemplate, NewSOPTemplate,
  RenderTemplate, NewRenderTemplate,
} from '@/db/schema';

export type { Comment, TaskLog } from '@/db/schema';

// ==================== API 请求基础设施 ====================

/** API 响应格式 */
export type ApiResponse<T> = { data?: T; error?: string };

// GET 请求去重：相同 URL 的并发请求共享同一个 Promise
const inflightRequests = new Map<string, Promise<ApiResponse<unknown>>>();

export async function apiRequest<T>(
  url: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const method = options?.method || 'GET';
  
  // 仅对 GET 请求去重
  if (method === 'GET') {
    const existing = inflightRequests.get(url);
    if (existing) {
      return existing as Promise<ApiResponse<T>>;
    }
    
    const promise = doRequest<T>(url, options).finally(() => {
      inflightRequests.delete(url);
    });
    inflightRequests.set(url, promise as Promise<ApiResponse<unknown>>);
    return promise;
  }
  
  return doRequest<T>(url, options);
}

async function doRequest<T>(
  url: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    // 30 秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'Request timeout (30s)' };
    }
    return { error: err instanceof Error ? err.message : 'Network request failed' };
  }
}

// ==================== CRUD API Client 工厂 ====================

/** 标准 CRUD API 客户端接口 */
export interface CrudApiClient<T, TNew = Record<string, unknown>> {
  getAll(filters?: Record<string, string | undefined>): Promise<ApiResponse<T[]>>;
  create(data: Omit<TNew, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<T>>;
  update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<ApiResponse<T>>;
  delete(id: string): Promise<ApiResponse<{ success: boolean }>>;
}

/** 创建标准 CRUD API 客户端 */
function createCrudApiClient<T, TNew = Record<string, unknown>>(
  basePath: string,
  filterKeys?: string[]
): CrudApiClient<T, TNew> {
  return {
    async getAll(filters?: Record<string, string | undefined>) {
      const params = new URLSearchParams();
      if (filters && filterKeys) {
        for (const key of filterKeys) {
          if (filters[key]) params.set(key, filters[key]!);
        }
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiRequest<T[]>(`${basePath}${query}`);
    },
    async create(data) {
      return apiRequest<T>(basePath, { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, updates) {
      return apiRequest<T>(`${basePath}/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    },
    async delete(id) {
      return apiRequest<{ success: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}

// ==================== API 客户端实例 ====================

export const projectsApi = createCrudApiClient<Project, NewProject>('/api/projects');

export const tasksApi = createCrudApiClient<Task, NewTask>('/api/tasks', ['projectId', 'memberId']);

export const membersApi = createCrudApiClient<Member, NewMember>('/api/members');

export const documentsApi = {
  ...createCrudApiClient<Document, NewDocument>('/api/documents', ['projectId', 'source']),
  async getById(id: string): Promise<ApiResponse<Document>> {
    return apiRequest<Document>(`/api/documents/${id}`);
  },
};

export const scheduledTasksApi = createCrudApiClient<ScheduledTask, NewScheduledTask>(
  '/api/scheduled-tasks', ['memberId']
);

export const deliveriesApi = {
  ...createCrudApiClient<Delivery, NewDelivery>('/api/deliveries', ['memberId', 'status']),
  // 覆写 update 以支持 extraBody
  async update(id: string, updates: Partial<Omit<Delivery, 'id' | 'createdAt'>>, extraBody?: Record<string, unknown>): Promise<ApiResponse<Delivery>> {
    return apiRequest<Delivery>(`/api/deliveries/${id}`, { method: 'PUT', body: JSON.stringify({ ...updates, ...extraBody }) });
  },
};

export const milestonesApi = createCrudApiClient<Milestone, NewMilestone>('/api/milestones', ['projectId']);

// v3.0: SOP 模板和渲染模板 API 客户端
export const sopTemplatesApi = {
  ...createCrudApiClient<SOPTemplate, NewSOPTemplate>('/api/sop-templates', ['category', 'status', 'projectId']),
  async getById(id: string): Promise<ApiResponse<SOPTemplate>> {
    return apiRequest<SOPTemplate>(`/api/sop-templates/${id}`);
  },
};

export const renderTemplatesApi = {
  ...createCrudApiClient<RenderTemplate, NewRenderTemplate>('/api/render-templates', ['category', 'status']),
  async getById(id: string): Promise<ApiResponse<RenderTemplate>> {
    return apiRequest<RenderTemplate>(`/api/render-templates/${id}`);
  },
};

// ==================== 非标准 API 客户端（特殊接口） ====================

export const commentsApi = {
  async getByTask(taskId: string): Promise<ApiResponse<Comment[]>> {
    return apiRequest<Comment[]>(`/api/comments?taskId=${encodeURIComponent(taskId)}`);
  },
  async create(comment: { taskId: string; memberId: string; content: string }): Promise<ApiResponse<Comment>> {
    return apiRequest<Comment>('/api/comments', { method: 'POST', body: JSON.stringify(comment) });
  },
  async delete(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/comments/${id}`, { method: 'DELETE' });
  },
};

export const taskLogsApi = {
  async getByTask(taskId: string): Promise<ApiResponse<TaskLog[]>> {
    return apiRequest<TaskLog[]>(`/api/task-logs?taskId=${encodeURIComponent(taskId)}`);
  },
  async create(log: { taskId: string; action: string; message: string }): Promise<ApiResponse<TaskLog>> {
    return apiRequest<TaskLog>('/api/task-logs', { method: 'POST', body: JSON.stringify(log) });
  },
};

export const openclawStatusApi = {
  async getAll(): Promise<ApiResponse<OpenClawStatus[]>> {
    return apiRequest<OpenClawStatus[]>('/api/openclaw-status');
  },
  async upsert(data: Partial<NewOpenClawStatus> & { memberId: string }): Promise<ApiResponse<OpenClawStatus>> {
    return apiRequest<OpenClawStatus>('/api/openclaw-status', { method: 'POST', body: JSON.stringify(data) });
  },
};
