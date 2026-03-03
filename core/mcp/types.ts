/**
 * MCP 指令类型定义
 */

export interface ActionInstruction {
  type: 
    | 'update_task'
    | 'add_comment'
    | 'create_check_item'
    | 'complete_check_item'
    | 'create_document'
    | 'update_document'
    | 'request_info'
    | 'ask_user'
    | 'update_status'
    | 'set_queue'
    | 'set_do_not_disturb'
    | 'create_schedule'
    | 'list_schedules'
    | 'delete_schedule'
    | 'update_schedule'
    | 'deliver_document'
    | 'review_delivery'
    | 'list_my_deliveries'
    | 'get_delivery'
    | 'register_member'
    | 'create_milestone'
    | 'list_milestones'
    | 'update_milestone'
    | 'delete_milestone'
    // SOP 引擎相关（v3.0 新增）
    | 'advance_sop_stage'
    | 'request_sop_confirm'
    | 'get_sop_context'
    | 'save_stage_output'
    | 'update_knowledge'
    // AI 自主创作相关（v3.0 新增）
    | 'create_sop_template'
    | 'update_sop_template'
    | 'create_render_template'
    | 'update_render_template';

  // 任务相关
  task_id?: string;
  status?: string;
  progress?: number;
  message?: string;
  content?: string;
  text?: string;
  item_id?: string;

  // 文档相关
  title?: string;
  document_id?: string;
  project_id?: string;
  doc_type?: string;
  render_mode?: 'markdown' | 'visual';
  render_template_id?: string;

  // 请求信息相关
  info_type?: 'document' | 'project' | 'task' | 'member';
  info_id?: string;
  query?: string;

  // 用户交互
  question?: string;
  options?: string[];
  urgent?: boolean;

  // 状态相关
  member_id?: string;
  current_action?: string;
  queued_tasks?: Array<{ id: string; title: string }>;
  interruptible?: boolean;
  do_not_disturb_reason?: string;

  // 定时任务相关
  task_type?: string;
  schedule_type?: string;
  schedule_time?: string;
  schedule_days?: number[];
  description?: string;
  schedule_config?: Record<string, unknown>;
  schedule_id?: string;
  enabled?: boolean;

  // 交付相关
  platform?: string;
  external_url?: string;
  delivery_id?: string;
  review_status?: 'approved' | 'rejected' | 'revision_needed';
  review_comment?: string;
  delivery_status?: 'pending' | 'approved' | 'rejected' | 'revision_needed' | 'all';
  limit?: number;

  // 成员注册
  name?: string;
  endpoint?: string;
  deploy_mode?: string;
  execution_mode?: string;
  tools?: string[];
  task_types?: string[];
  api_token?: string;

  // 里程碑相关
  milestone_id?: string;
  sort_order?: number;
  due_date?: string;

  // SOP 执行相关（v3.0 新增）
  stage_output?: string;
  confirm_message?: string;
  output?: string;
  output_type?: 'text' | 'markdown' | 'html' | 'data' | 'file';
  layer?: string;  // Know-how 层级（L4）

  // SOP 模板创建相关（v3.0 新增）
  template_id?: string;
  category?: string;
  stages?: Array<{
    id: string;
    label: string;
    type: string;
    promptTemplate?: string;
    outputType?: string;
    requireConfirm?: boolean;
  }>;
  system_prompt?: string;
  required_tools?: string[];
  quality_checklist?: string[];

  // 渲染模板创建相关（v3.0 新增）
  html_template?: string;
  css_template?: string;
  md_template?: string;
  slots?: Record<string, unknown>;
  sections?: Array<{ id: string; label: string; slotIds?: string[] }>;
  export_config?: {
    format?: 'png' | 'jpeg' | 'pdf';
    width?: number;
    height?: number;
    scale?: number;
  };
  template_status?: 'draft' | 'active' | 'archived';
}

export interface ExecutionResult {
  actionType: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  urgent: boolean;
  askedAt: Date;
}
