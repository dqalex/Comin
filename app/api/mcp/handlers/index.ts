/**
 * MCP Handlers 统一导出
 */

export { handleGetTask, handleUpdateTaskStatus, handleAddTaskComment, handleCreateCheckItem, handleCompleteCheckItem, handleListMyTasks } from './task.handler';
export { handleGetProject, handleGetProjectMembers } from './project.handler';
export { handleGetDocument, handleCreateDocument, handleUpdateDocument, handleSearchDocuments } from './document.handler';
export { handleUpdateStatus, handleSetQueue, handleSetDoNotDisturb } from './status.handler';
export { handleCreateSchedule, handleListSchedules, handleDeleteSchedule, handleUpdateSchedule } from './schedule.handler';
export { handleDeliverDocument, handleReviewDelivery, handleListMyDeliveries, handleGetDelivery } from './delivery.handler';
export { handleCreateMilestone, handleListMilestones, handleUpdateMilestone, handleDeleteMilestone } from './milestone.handler';
export { handleRegisterMember, handleGetMcpToken } from './member.handler';
export { handleGetTemplate, handleListTemplates } from './template.handler';
// SOP 引擎相关（v3.0 新增）
export {
  handleAdvanceSopStage,
  handleRequestSopConfirm,
  handleGetSopContext,
  handleSaveStageOutput,
  handleUpdateKnowledge,
  handleCreateSopTemplate,
  handleUpdateSopTemplate,
  handleCreateRenderTemplate,
  handleUpdateRenderTemplate,
  handleListRenderTemplates,
  handleGetRenderTemplate,
} from './sop.handler';
// Agent MCP Token（v3.0 Phase F 新增）
export {
  handleGetAgentMcpToken,
  handleListAgentMcpTokens,
  handleRevokeAgentMcpToken,
} from './agent-token.handler';
// 上下文获取工具（v3.0 Phase F 渐进式）
export {
  handleGetTaskDetail,
  handleGetProjectDetail,
  handleGetDocumentDetail,
  handleGetSopPreviousOutput,
  handleGetSopKnowledgeLayer,
} from './context.handler';
// Skill 工具（v3.0 SkillHub 集成）
export {
  handleInvokeSkill,
  handleListSkills,
} from './skill.handler';
