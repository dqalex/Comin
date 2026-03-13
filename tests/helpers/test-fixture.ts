/**
 * 测试数据工厂
 *
 * 提供统一的测试数据生成方法，确保测试数据的一致性和可追溯性。
 * 所有测试数据都带有 [测试] 前缀，方便识别和清理。
 *
 * 使用方式：
 * ```ts
 * import { TestDataFactory } from '@/tests/helpers/test-fixture';
 *
 * const factory = new TestDataFactory();
 * const task = factory.createTask({ title: '自定义标题' });
 * const project = factory.createProject();
 * ```
 */

import { apiPost, apiDelete, type ApiResponse } from './api-client';

/** 生成唯一 ID */
export function generateId(prefix: string = 'test'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/** 任务数据 */
export interface TaskData {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'reviewing' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string | null;
  assigneeId?: string | null;
  deadline?: string | null;
  tags?: string[];
}

/** 项目数据 */
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'completed';
  color?: string;
  icon?: string;
}

/** 文档数据 */
export interface DocumentData {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'guide' | 'reference' | 'report' | 'decision' | 'other';
  projectId?: string | null;
}

/** 成员数据 */
export interface MemberData {
  id: string;
  name: string;
  type: 'human' | 'ai';
  role?: string;
  skills?: string[];
  avatarUrl?: string | null;
}

/** SOP 模板数据 */
export interface SOPTemplateData {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'draft' | 'active' | 'archived';
  stages: Array<{
    id: string;
    label: string;
    type: 'input' | 'ai_auto' | 'ai_with_confirm' | 'manual' | 'render' | 'export' | 'review';
    promptTemplate?: string;
    outputType?: string;
  }>;
  systemPrompt?: string;
}

/** 定时任务数据 */
export interface ScheduleData {
  id: string;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  memberId?: string | null;
}

/**
 * 测试数据工厂类
 */
export class TestDataFactory {
  private createdResources: Array<{ type: string; id: string; cleanup: () => Promise<void> }> = [];
  private authHeaders: Record<string, string> = {};

  /**
   * 设置认证头
   */
  setAuthHeaders(headers: Record<string, string>): void {
    this.authHeaders = headers;
  }

  /**
   * 创建任务
   */
  async createTask(overrides: Partial<TaskData> = {}): Promise<TaskData> {
    const id = overrides.id || generateId('task');
    const task: TaskData = {
      id,
      title: '[测试] 任务 ' + id.slice(-6),
      description: '测试任务描述',
      status: 'todo',
      priority: 'medium',
      projectId: null,
      assigneeId: null,
      ...overrides,
    };

    const res = await apiPost('/api/tasks', {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      deadline: task.deadline,
      tags: task.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { headers: this.authHeaders });

    if (res.ok) {
      this.createdResources.push({
        type: 'task',
        id: task.id,
        cleanup: async () => {
          await apiDelete(`/api/tasks/${task.id}`, { headers: this.authHeaders });
        },
      });
    }

    return task;
  }

  /**
   * 创建项目
   */
  async createProject(overrides: Partial<ProjectData> = {}): Promise<ProjectData> {
    const id = overrides.id || generateId('proj');
    const project: ProjectData = {
      id,
      name: '[测试] 项目 ' + id.slice(-6),
      description: '测试项目描述',
      status: 'active',
      color: '#3B82F6',
      icon: 'folder',
      ...overrides,
    };

    const res = await apiPost('/api/projects', {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      color: project.color,
      icon: project.icon,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { headers: this.authHeaders });

    if (res.ok) {
      this.createdResources.push({
        type: 'project',
        id: project.id,
        cleanup: async () => {
          await apiDelete(`/api/projects/${project.id}`, { headers: this.authHeaders });
        },
      });
    }

    return project;
  }

  /**
   * 创建文档
   */
  async createDocument(overrides: Partial<DocumentData> = {}): Promise<DocumentData> {
    const id = overrides.id || generateId('doc');
    const doc: DocumentData = {
      id,
      title: '[测试] 文档 ' + id.slice(-6),
      content: '# 测试文档\n\n这是一个测试文档的内容。',
      type: 'note',
      projectId: null,
      ...overrides,
    };

    const res = await apiPost('/api/documents', {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      type: doc.type,
      source: 'local',
      projectId: doc.projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { headers: this.authHeaders });

    if (res.ok) {
      this.createdResources.push({
        type: 'document',
        id: doc.id,
        cleanup: async () => {
          await apiDelete(`/api/documents/${doc.id}`, { headers: this.authHeaders });
        },
      });
    }

    return doc;
  }

  /**
   * 创建成员
   */
  async createMember(overrides: Partial<MemberData> = {}): Promise<MemberData> {
    const id = overrides.id || generateId('member');
    const member: MemberData = {
      id,
      name: '[测试] 成员 ' + id.slice(-6),
      type: 'human',
      role: 'member',
      skills: [],
      avatarUrl: null,
      ...overrides,
    };

    const res = await apiPost('/api/members', {
      id: member.id,
      name: member.name,
      type: member.type,
      role: member.role,
      skills: member.skills,
      avatarUrl: member.avatarUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { headers: this.authHeaders });

    if (res.ok) {
      this.createdResources.push({
        type: 'member',
        id: member.id,
        cleanup: async () => {
          await apiDelete(`/api/members/${member.id}`, { headers: this.authHeaders });
        },
      });
    }

    return member;
  }

  /**
   * 创建 SOP 模板
   */
  async createSOPTemplate(overrides: Partial<SOPTemplateData> = {}): Promise<SOPTemplateData> {
    const id = overrides.id || generateId('sop');
    const template: SOPTemplateData = {
      id,
      name: '[测试] SOP 模板 ' + id.slice(-6),
      description: '测试 SOP 模板描述',
      category: 'custom',
      status: 'active',
      stages: [
        { id: 'stage-1', label: '输入', type: 'input' },
        { id: 'stage-2', label: '处理', type: 'ai_auto' },
        { id: 'stage-3', label: '输出', type: 'manual' },
      ],
      systemPrompt: '你是一个测试助手',
      ...overrides,
    };

    const res = await apiPost('/api/sop-templates', {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      status: template.status,
      stages: template.stages,
      systemPrompt: template.systemPrompt,
      icon: 'clipboard-list',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { headers: this.authHeaders });

    if (res.ok) {
      this.createdResources.push({
        type: 'sop-template',
        id: template.id,
        cleanup: async () => {
          await apiDelete(`/api/sop-templates/${template.id}`, { headers: this.authHeaders });
        },
      });
    }

    return template;
  }

  /**
   * 创建定时任务
   */
  async createSchedule(overrides: Partial<ScheduleData> = {}): Promise<ScheduleData> {
    const id = overrides.id || generateId('schedule');
    const schedule: ScheduleData = {
      id,
      name: '[测试] 定时任务 ' + id.slice(-6),
      cron: '0 9 * * *', // 每天 9:00
      prompt: '执行测试任务',
      enabled: false,
      memberId: null,
      ...overrides,
    };

    const res = await apiPost('/api/scheduled-tasks', {
      id: schedule.id,
      name: schedule.name,
      cron: schedule.cron,
      prompt: schedule.prompt,
      enabled: schedule.enabled,
      memberId: schedule.memberId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { headers: this.authHeaders });

    if (res.ok) {
      this.createdResources.push({
        type: 'schedule',
        id: schedule.id,
        cleanup: async () => {
          await apiDelete(`/api/scheduled-tasks/${schedule.id}`, { headers: this.authHeaders });
        },
      });
    }

    return schedule;
  }

  /**
   * 清理所有创建的资源
   */
  async cleanup(): Promise<void> {
    // 按创建顺序的逆序删除
    const resources = [...this.createdResources].reverse();

    for (const resource of resources) {
      try {
        await resource.cleanup();
      } catch (error) {
        console.warn(`[清理失败] ${resource.type}:${resource.id}`, error);
      }
    }

    this.createdResources = [];
  }

  /**
   * 获取已创建的资源列表
   */
  getCreatedResources(): Array<{ type: string; id: string }> {
    return this.createdResources.map(r => ({ type: r.type, id: r.id }));
  }
}
