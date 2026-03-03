/**
 * Store 统一导出
 */

// 领域 Store
export { useProjectStore } from './project.store';
export { useTaskStore } from './task.store';
export { useMemberStore } from './member.store';
export { useDocumentStore } from './document.store';
export { useOpenClawStatusStore } from './openclaw.store';
export { useOpenClawWorkspaceStore } from './openclaw-workspace.store';
export { useScheduledTaskStore } from './schedule.store';
export { useDeliveryStore } from './delivery.store';
export { useMilestoneStore } from './milestone.store';
export { useCommentStore } from './comment.store';
export { useTaskLogStore } from './tasklog.store';

// v3.0 新增 Store
export { useSOPTemplateStore } from './sop-template.store';
export { useRenderTemplateStore } from './render-template.store';

// UI Store
export { useUIStore } from './ui.store';

// Chat Store
export { useChatStore } from './chat.store';

// Gateway Store
export { useGatewayStore } from './gateway.store';

// 类型 re-export
export type { Comment, TaskLog, SOPTemplate, RenderTemplate } from '@/db/schema';

// 数据初始化 Hook
import { useProjectStore } from './project.store';
import { useTaskStore } from './task.store';
import { useMemberStore } from './member.store';
import { useDocumentStore } from './document.store';
import { useOpenClawStatusStore } from './openclaw.store';
import { useScheduledTaskStore } from './schedule.store';
import { useDeliveryStore } from './delivery.store';
import { useMilestoneStore } from './milestone.store';
import { useUIStore } from './ui.store';
import { useChatStore } from './chat.store';
import { useSOPTemplateStore } from './sop-template.store';
import { useRenderTemplateStore } from './render-template.store';

export function useDataInitializer() {
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  const fetchOpenClawStatus = useOpenClawStatusStore((s) => s.fetchStatus);
  const fetchScheduledTasks = useScheduledTaskStore((s) => s.fetchTasks);
  const fetchDeliveries = useDeliveryStore((s) => s.fetchDeliveries);
  const fetchMilestones = useMilestoneStore((s) => s.fetchMilestones);
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const fetchSOPTemplates = useSOPTemplateStore((s) => s.fetchTemplates);
  const fetchRenderTemplates = useRenderTemplateStore((s) => s.fetchTemplates);
  const hydrated = useUIStore((s) => s.hydrated);

  const initialize = async () => {
    const results = await Promise.allSettled([
      fetchProjects(),
      fetchTasks(),
      fetchMembers(),
      fetchDocuments(),
      fetchOpenClawStatus(),
      fetchScheduledTasks(),
      fetchDeliveries(),
      fetchMilestones(),
      fetchSessions(),
      fetchSOPTemplates(),
      fetchRenderTemplates(),
    ]);
    
    // Log failed initializations without blocking others
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const names = ['projects', 'tasks', 'members', 'documents', 'openclawStatus', 'scheduledTasks', 'deliveries', 'milestones', 'sessions', 'sopTemplates', 'renderTemplates'];
        console.error(`[DataInit] Failed to fetch ${names[idx]}:`, result.reason);
      }
    });
  };

  return { initialize, hydrated };
}
