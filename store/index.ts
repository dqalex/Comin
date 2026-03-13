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

// v3.0 Phase E: Auth Store
export { useAuthStore } from './auth.store';
export type { SafeUser } from './auth.store';
export { useUserMcpTokenStore } from './user-mcp-token.store';
export type { SafeUserMcpToken } from './user-mcp-token.store';

// v3.0 SkillHub: Skill Store
export { useSkillStore, skillStoreApi } from './skill.store';
export type { SkillStatus, SkillTrustStatus, SkillCategory } from './skill.store';

// v3.0 Approval Store
export { useApprovalStore } from './approval';

// 类型 re-export
export type { Comment, TaskLog, SOPTemplate, RenderTemplate } from '@/db/schema';

// 数据初始化 Hook - 从独立文件导出以保持 store/index.ts 简洁
export { useDataInitializer } from '@/hooks/useDataInitializer';
