/**
 * 实体数据订阅 Hook
 * 
 * 集中管理常用的实体数据订阅，减少组件中的重复代码
 * 
 * 使用示例：
 * ```typescript
 * const { members, projects, tasks, documents, isLoading } = useEntityData();
 * ```
 */
import { useMemo } from 'react';
import { useMemberStore, useProjectStore, useTaskStore, useDocumentStore, useMilestoneStore, useSOPTemplateStore, useRenderTemplateStore } from '@/store';

export interface EntityData {
  // 数据
  members: ReturnType<typeof useMemberStore.getState>['members'];
  projects: ReturnType<typeof useProjectStore.getState>['projects'];
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'];
  documents: ReturnType<typeof useDocumentStore.getState>['documents'];
  milestones: ReturnType<typeof useMilestoneStore.getState>['milestones'];
  sopTemplates: ReturnType<typeof useSOPTemplateStore.getState>['templates'];
  renderTemplates: ReturnType<typeof useRenderTemplateStore.getState>['templates'];
  
  // 加载状态
  isLoading: boolean;
  
  // 方法
  refetchMembers: () => Promise<void>;
  refetchProjects: () => Promise<void>;
  refetchTasks: () => Promise<void>;
  refetchDocuments: () => Promise<void>;
}

export function useEntityData(): EntityData {
  // 数据订阅 - 使用精确 selector
  const members = useMemberStore((s) => s.members);
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  const documents = useDocumentStore((s) => s.documents);
  const milestones = useMilestoneStore((s) => s.milestones);
  const sopTemplates = useSOPTemplateStore((s) => s.templates);
  const renderTemplates = useRenderTemplateStore((s) => s.templates);
  
  // 加载状态订阅
  const membersLoading = useMemberStore((s) => s.loading);
  const projectsLoading = useProjectStore((s) => s.loading);
  const tasksLoading = useTaskStore((s) => s.loading);
  const documentsLoading = useDocumentStore((s) => s.loading);
  
  // 方法订阅
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  
  // 计算加载状态
  const isLoading = useMemo(() => 
    membersLoading || projectsLoading || tasksLoading || documentsLoading,
    [membersLoading, projectsLoading, tasksLoading, documentsLoading]
  );
  
  return {
    members,
    projects,
    tasks,
    documents,
    milestones,
    sopTemplates,
    renderTemplates,
    isLoading,
    refetchMembers: fetchMembers,
    refetchProjects: fetchProjects,
    refetchTasks: fetchTasks,
    refetchDocuments: fetchDocuments,
  };
}

/**
 * 仅订阅 AI 成员
 */
export function useAIMembers() {
  const members = useMemberStore((s) => s.members);
  return useMemo(() => members.filter((m) => m.type === 'ai'), [members]);
}

/**
 * 仅订阅人类成员
 */
export function useHumanMembers() {
  const members = useMemberStore((s) => s.members);
  return useMemo(() => members.filter((m) => m.type === 'human'), [members]);
}

/**
 * 按项目过滤的任务
 */
export function useTasksByProject(projectId: string | null) {
  const tasks = useTaskStore((s) => s.tasks);
  return useMemo(() => {
    if (!projectId) return tasks;
    return tasks.filter((t) => t.projectId === projectId);
  }, [tasks, projectId]);
}

/**
 * 按状态过滤的任务
 */
export function useTasksByStatus(status: string) {
  const tasks = useTaskStore((s) => s.tasks);
  return useMemo(() => tasks.filter((t) => t.status === status), [tasks, status]);
}

/**
 * 获取当前项目及其任务
 */
export function useCurrentProjectWithTasks() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  
  return useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    const projectTasks = currentProjectId 
      ? tasks.filter((t) => t.projectId === currentProjectId)
      : tasks;
    
    return {
      project: project || null,
      tasks: projectTasks,
      hasProject: !!project,
    };
  }, [currentProjectId, projects, tasks]);
}
