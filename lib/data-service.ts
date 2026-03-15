/**
 * 数据访问层抽象
 */

import type { 
  Project, Task, Member, MemberWithRole, Document,
  NewProject, NewTask, NewMember, NewDocument,
  OpenClawStatus, NewOpenClawStatus,
  OpenClawWorkspace, OpenClawFile,
  ScheduledTask, NewScheduledTask,
  ScheduledTaskHistory,
  Delivery, NewDelivery,
  Milestone, NewMilestone,
  Comment,
  TaskLog,
  SOPTemplate, NewSOPTemplate,
  RenderTemplate, NewRenderTemplate,
  Skill, NewSkill,
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

export const membersApi = createCrudApiClient<MemberWithRole, NewMember>('/api/members');

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

// OpenClaw Workspace API 客户端
export const openclawWorkspacesApi = {
  async getAll(): Promise<ApiResponse<OpenClawWorkspace[]>> {
    return apiRequest<OpenClawWorkspace[]>('/api/openclaw-workspaces');
  },
  async create(data: {
    name: string;
    path: string;
    memberId?: string;
    isDefault?: boolean;
    syncEnabled?: boolean;
    watchEnabled?: boolean;
    syncInterval?: number;
    excludePatterns?: string[];
  }): Promise<ApiResponse<OpenClawWorkspace>> {
    return apiRequest<OpenClawWorkspace>('/api/openclaw-workspaces', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: Partial<OpenClawWorkspace>): Promise<ApiResponse<OpenClawWorkspace>> {
    return apiRequest<OpenClawWorkspace>(`/api/openclaw-workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async delete(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/openclaw-workspaces/${id}`, { method: 'DELETE' });
  },
  async sync(id: string, mode: 'full' | 'incremental' = 'incremental'): Promise<ApiResponse<{
    synced: number;
    created: number;
    updated: number;
    conflicts: number;
    errors: Array<{ file: string; error: string }>;
  }>> {
    return apiRequest(`/api/openclaw-workspaces/${id}/sync`, { method: 'POST', body: JSON.stringify({ mode }) });
  },
  async scan(id: string): Promise<ApiResponse<{
    total: number;
    byType: Record<string, number>;
    files: Array<{
      path: string;
      type: string;
      size: number;
      modifiedAt: string;
      status: 'new' | 'modified' | 'synced' | 'conflict';
    }>;
  }>> {
    return apiRequest(`/api/openclaw-workspaces/${id}/scan`, { method: 'POST' });
  },
  async getStatus(id: string): Promise<ApiResponse<{
    status: string;
    lastSyncAt: string | null;
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    conflictFiles: number;
  }>> {
    return apiRequest(`/api/openclaw-workspaces/${id}/status`);
  },
};

// OpenClaw Files API 客户端
export const openclawFilesApi = {
  async getAll(workspaceId?: string): Promise<ApiResponse<OpenClawFile[]>> {
    const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
    return apiRequest<OpenClawFile[]>(`/api/openclaw-files${query}`);
  },
};

// v3.0 SkillHub: Skill API 客户端
export const skillsApi = {
  ...createCrudApiClient<Skill, NewSkill>('/api/skills', ['status', 'category', 'source']),
  
  // 获取单个 Skill
  // API 返回 { data: { ...skill, trustRecords, _access } }，需要解包
  async getById(id: string): Promise<ApiResponse<Skill>> {
    const result = await apiRequest<{ data: Skill & { trustRecords?: unknown[]; _access?: unknown } }>(`/api/skills/${id}`);
    if (result.data?.data) {
      return { data: result.data.data };
    }
    return { error: result.error || 'Invalid response format' };
  },
  
  // 提交审批
  async submitForApproval(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/submit`, { 
      method: 'POST' 
    });
  },
  
  // 审批通过
  async approve(id: string, note?: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/approve`, { 
      method: 'POST',
      body: JSON.stringify({ note })
    });
  },
  
  // 审批拒绝
  async reject(id: string, note?: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/reject`, { 
      method: 'POST',
      body: JSON.stringify({ note })
    });
  },
  
  // 信任 Skill
  async trust(id: string, data?: { agentId?: string; note?: string }): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/trust`, { 
      method: 'POST',
      body: JSON.stringify(data || {})
    });
  },
  
  // 拒绝 Skill
  async untrust(id: string, data?: { agentId?: string; note?: string; uninstall?: boolean }): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/untrust`, { 
      method: 'POST',
      body: JSON.stringify(data || {})
    });
  },
  
  // 安装到 Agent
  async install(id: string, agentId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/install`, { 
      method: 'POST',
      body: JSON.stringify({ agentId })
    });
  },
  
  // 从 Agent 卸载
  async uninstall(id: string, agentId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}/uninstall`, { 
      method: 'POST',
      body: JSON.stringify({ agentId })
    });
  },
  
  // 获取风险报告（管理员）
  async getRiskReport(): Promise<ApiResponse<{
    summary: { totalRisky: number; pending: number; untrusted: number };
    riskySkills: Skill[];
  }>> {
    return apiRequest('/api/skills/risk-report');
  },
  
  // 创建 Skill 快照
  async createSnapshot(agentId: string): Promise<ApiResponse<{
    success: boolean;
    snapshot: {
      id: string;
      agentId: string;
      skillCount: number;
    };
  }>> {
    return apiRequest('/api/skills/snapshot', {
      method: 'POST',
      body: JSON.stringify({ agentId })
    });
  },
  
  // 发现项目内的 Skill
  async discover(): Promise<ApiResponse<{
    skills: Array<{
      name: string;
      description: string;
      version: string;
      category?: string;
      skillPath: string;
      namespace: string;
      skillKey: string;
      valid: boolean;
      errors: string[];
      warnings: string[];
      installStatus: 'not_installed' | 'installed' | 'update_available';
      installedVersion?: string;
      installedId?: string;
    }>;
    stats: {
      total: number;
      valid: number;
      notInstalled: number;
      installed: number;
      updateAvailable: number;
    };
    skillsFolderPath: string;
  }>> {
    return apiRequest('/api/skills/discover');
  },
  
  // 从项目文件夹安装/更新 Skill
  async installFromPath(skillPath: string, force = false): Promise<ApiResponse<{
    id: string;
    skillKey: string;
    name: string;
    version?: string;
    previousVersion?: string;
    newVersion?: string;
    action: 'created' | 'updated' | 'no_update';
    status?: string;
    approvalId?: string;
    isSensitive?: boolean;
    sensitivityReasons?: string[];
    validationWarnings?: string[];
  }>> {
    return apiRequest('/api/skills/install', {
      method: 'POST',
      body: JSON.stringify({ skillPath, force })
    });
  },
};
