/**
 * MCP 工具注册表（单一数据源）
 * 
 * 统一管理所有工具到 handler 的映射关系
 * 由 /api/mcp/route.ts 和 /api/mcp/external/route.ts 共同引用
 */

import type { ComindToolName } from '@/core/mcp/definitions';
import {
  handleGetTask, handleUpdateTaskStatus, handleAddTaskComment, handleCreateCheckItem, handleCompleteCheckItem, handleListMyTasks,
  handleGetProject, handleGetProjectMembers,
  handleGetDocument, handleCreateDocument, handleUpdateDocument, handleSearchDocuments,
  handleUpdateStatus, handleSetQueue, handleSetDoNotDisturb,
  handleCreateSchedule, handleListSchedules, handleDeleteSchedule, handleUpdateSchedule,
  handleDeliverDocument, handleReviewDelivery, handleListMyDeliveries, handleGetDelivery,
  handleRegisterMember,
  handleGetTemplate, handleListTemplates,
  handleCreateMilestone, handleListMilestones, handleUpdateMilestone, handleDeleteMilestone,
  // SOP 引擎相关（v3.0 新增）
  handleAdvanceSopStage, handleRequestSopConfirm, handleGetSopContext, handleSaveStageOutput, handleUpdateKnowledge,
  handleCreateSopTemplate, handleUpdateSopTemplate, handleCreateRenderTemplate, handleUpdateRenderTemplate,
} from './index';

/**
 * 工具名 → handler 映射表
 * 新增工具只需在此处添加一条映射
 */
export const TOOL_HANDLERS: Record<ComindToolName, (params: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>> = {
  get_task: handleGetTask,
  list_my_tasks: handleListMyTasks,
  update_task_status: handleUpdateTaskStatus,
  add_task_comment: handleAddTaskComment,
  create_check_item: handleCreateCheckItem,
  complete_check_item: handleCompleteCheckItem,
  get_project: handleGetProject,
  get_project_members: handleGetProjectMembers,
  get_document: handleGetDocument,
  create_document: handleCreateDocument,
  update_document: handleUpdateDocument,
  search_documents: handleSearchDocuments,
  update_status: handleUpdateStatus,
  set_queue: handleSetQueue,
  set_do_not_disturb: handleSetDoNotDisturb,
  create_schedule: handleCreateSchedule,
  list_schedules: handleListSchedules,
  delete_schedule: handleDeleteSchedule,
  update_schedule: handleUpdateSchedule,
  deliver_document: handleDeliverDocument,
  review_delivery: handleReviewDelivery,
  list_my_deliveries: handleListMyDeliveries,
  get_delivery: handleGetDelivery,
  register_member: handleRegisterMember,
  get_template: handleGetTemplate,
  list_templates: handleListTemplates,
  create_milestone: handleCreateMilestone,
  list_milestones: handleListMilestones,
  update_milestone: handleUpdateMilestone,
  delete_milestone: handleDeleteMilestone,
  // SOP 引擎工具（v3.0 新增）
  advance_sop_stage: handleAdvanceSopStage,
  request_sop_confirm: handleRequestSopConfirm,
  get_sop_context: handleGetSopContext,
  save_stage_output: handleSaveStageOutput,
  update_knowledge: handleUpdateKnowledge,
  // AI 自主创作工具（v3.0 新增）
  create_sop_template: handleCreateSopTemplate,
  update_sop_template: handleUpdateSopTemplate,
  create_render_template: handleCreateRenderTemplate,
  update_render_template: handleUpdateRenderTemplate,
};

/** 需要自动注入 member_id 的工具列表 */
export const MEMBER_SCOPED_TOOLS: string[] = [
  'update_status', 'set_queue', 'set_do_not_disturb',
  'create_schedule', 'deliver_document', 'review_delivery',
  'list_my_tasks',
];

/** CoMind 版本号（统一数据源） */
export const COMIND_VERSION = process.env.npm_package_version || '2.2.3';
