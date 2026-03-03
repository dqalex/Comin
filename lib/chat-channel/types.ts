/**
 * 对话信道数据交互模块 - 统一类型定义
 * 
 * 合并 ChatActionType 和 ActionInstruction，提供统一的操作类型
 */

// ============================================================================
// 基础枚举
// ============================================================================

/** 任务状态 */
export type TaskStatus = 'todo' | 'in_progress' | 'reviewing' | 'completed';

/** 任务优先级 */
export type TaskPriority = 'high' | 'medium' | 'low';

/** AI 状态 */
export type AIStatus = 'idle' | 'working' | 'waiting' | 'offline';

/** 文档类型 */
export type DocType = 'note' | 'report' | 'decision' | 'scheduled_task' | 'task_list' | 'other';

/** 交付平台 */
export type DeliveryPlatform = 'tencent-doc' | 'feishu' | 'notion' | 'local' | 'other';

/** 审核状态 */
export type ReviewStatus = 'approved' | 'rejected' | 'revision_needed';

/** 定时任务类型 */
export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';

/** 定时任务类型（业务） */
export type ScheduleTaskType = 'report' | 'summary' | 'backup' | 'notification' | 'custom';

// ============================================================================
// 操作分类
// ============================================================================

/** 查询类操作 */
export type QueryActionType =
  | 'get_task'
  | 'list_my_tasks'
  | 'get_project'
  | 'get_project_members'
  | 'get_document'
  | 'search_documents'
  | 'get_template'
  | 'list_templates'
  | 'list_schedules';

/** 写入类操作 */
export type WriteActionType =
  | 'update_task_status'
  | 'add_comment'
  | 'create_check_item'
  | 'complete_check_item'
  | 'create_document'
  | 'update_document'
  | 'deliver_document'
  | 'review_delivery'
  | 'register_member';

/** 状态类操作 */
export type StatusActionType =
  | 'update_status'
  | 'set_queue'
  | 'set_do_not_disturb';

/** 定时任务类操作 */
export type ScheduleActionType =
  | 'create_schedule'
  | 'update_schedule'
  | 'delete_schedule';

/** SOP 类操作 */
export type SOPActionType =
  | 'advance_sop_stage'
  | 'request_sop_confirm'
  | 'get_sop_context'
  | 'save_stage_output'
  | 'update_knowledge'
  | 'create_sop_template'
  | 'update_sop_template'
  | 'create_render_template'
  | 'update_render_template';

/** 扩展类操作（未来扩展） */
export type ExtensionActionType =
  | 'sync_identity'
  | 'get_mcp_token'
  | 'custom_action';

/** 统一操作类型 */
export type ActionType =
  | QueryActionType
  | WriteActionType
  | StatusActionType
  | ScheduleActionType
  | SOPActionType
  | ExtensionActionType;

// ============================================================================
// Action 参数定义
// ============================================================================

/** 基础 Action 结构 */
export interface BaseAction {
  type: ActionType;
}

/** 任务相关参数 */
export interface TaskParams {
  task_id?: string;
  progress?: number;
  message?: string;
  content?: string;
  text?: string;
  item_id?: string;
}

/** 文档相关参数 */
export interface DocumentParams {
  title?: string;
  document_id?: string;
  project_id?: string;
  doc_type?: DocType;
  content?: string;
}

/** 交付相关参数 */
export interface DeliveryParams {
  platform?: DeliveryPlatform;
  external_url?: string;
  delivery_id?: string;
  review_status?: ReviewStatus;
  review_comment?: string;
}

/** 状态相关参数 */
export interface StatusParams {
  member_id?: string;
  current_action?: string;
  queued_tasks?: Array<{ id: string; title: string }>;
  interruptible?: boolean;
  reason?: string;
}

/** 定时任务相关参数 */
export interface ScheduleParams {
  schedule_id?: string;
  task_type?: ScheduleTaskType;
  schedule_type?: ScheduleType;
  schedule_time?: string;
  schedule_days?: number[];
  description?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

/** 查询相关参数 */
export interface QueryParams {
  query?: string;
  limit?: number;
  enabled_only?: boolean;
}

/** 成员注册参数 */
export interface MemberParams {
  name?: string;
  endpoint?: string;
  deploy_mode?: string;
  execution_mode?: string;
  tools?: string[];
  task_types?: string[];
  api_token?: string;
}

/** SOP 相关参数 */
export interface SOPParams {
  stage_output?: string;
  confirm_message?: string;
  output?: string;
  output_type?: string;
  layer?: string;
  template_id?: string;
  category?: string;
  stages?: unknown[];
  system_prompt?: string;
  required_tools?: string[];
  quality_checklist?: string[];
  slots?: unknown[];
  sections?: unknown[];
  html_template?: string;
}

/** 统一 Action 定义 */
export interface Action extends BaseAction, TaskParams, DocumentParams, DeliveryParams, StatusParams, ScheduleParams, QueryParams, MemberParams, SOPParams {
  // 模板相关
  template_name?: string;
  
  // 扩展操作相关
  action_name?: string;
  params?: Record<string, unknown>;
  
  // 身份同步相关
  creature?: string;
  vibe?: string;
  emoji?: string;
  avatar?: string;
  
  // 统一 status 字段（任务状态或 AI 状态）
  status?: TaskStatus | AIStatus;
}

// ============================================================================
// 执行结果定义
// ============================================================================

/** 执行结果 */
export interface ActionResult {
  /** 操作类型 */
  type: ActionType;
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
  /** 返回数据 */
  data?: Record<string, unknown>;
  /** 错误代码（失败时） */
  errorCode?: ErrorCode;
  /** 时间戳 */
  timestamp: Date;
  /** 请求 ID */
  requestId?: string;
}

/** 批量执行结果 */
export interface BatchActionResult {
  /** 所有操作结果 */
  results: ActionResult[];
  /** 汇总统计 */
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  /** 请求 ID */
  requestId: string;
}

// ============================================================================
// 错误定义
// ============================================================================

/** 错误代码 */
export enum ErrorCode {
  // 参数错误
  INVALID_PARAMS = 'INVALID_PARAMS',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_TYPE = 'INVALID_TYPE',
  
  // 资源错误
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // 权限错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // 执行错误
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // 未知
  UNKNOWN = 'UNKNOWN',
}

/** 操作错误 */
export class ActionError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ActionError';
  }

  toResult(type: ActionType, requestId?: string): ActionResult {
    return {
      type,
      success: false,
      message: this.message,
      errorCode: this.code,
      timestamp: new Date(),
      requestId,
    };
  }
}

// ============================================================================
// 日志定义
// ============================================================================

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 日志条目 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 请求 ID */
  requestId: string;
  /** 操作类型 */
  action?: ActionType;
  /** 日志消息 */
  message: string;
  /** 额外数据 */
  data?: Record<string, unknown>;
  /** 错误信息 */
  error?: string;
  /** 执行耗时（毫秒） */
  duration?: number;
}

// ============================================================================
// 执行器选项
// ============================================================================

/** 执行器选项 */
export interface ExecutorOptions {
  /** 请求 ID（可选，自动生成） */
  requestId?: string;
  /** 来源 */
  source?: 'chat' | 'mcp' | 'websocket' | 'internal';
  /** 成员 ID（用于权限校验） */
  memberId?: string;
  /** 会话 ID */
  conversationId?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否触发前端刷新 */
  triggerRefresh?: boolean;
}

// ============================================================================
// 解析结果
// ============================================================================

/** 未识别 Action 的修正建议 */
export interface UnrecognizedAction {
  /** 原始 type 值 */
  originalType: string;
  /** 建议的正确 type（模糊匹配最近的） */
  suggestedType?: ActionType;
  /** 是否自动修正（相似度够高时自动修正） */
  autoFixed: boolean;
}

/** 解析结果 */
export interface ParseResult {
  /** 解析出的 Actions */
  actions: Action[];
  /** 清理后的内容（去除 JSON 块） */
  cleanContent: string;
  /** 是否包含 Actions */
  hasActions: boolean;
  /** 解析错误（如果有） */
  parseError?: string;
  /** 未识别的 Actions 及修正建议 */
  unrecognized?: UnrecognizedAction[];
}

// ============================================================================
// Action 定义元数据
// ============================================================================

/** Action 定义 */
export interface ActionDefinition {
  /** 操作类型 */
  type: ActionType;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 分类 */
  category: 'query' | 'write' | 'status' | 'schedule' | 'sop' | 'extension';
  /** 必填参数 */
  requiredParams: string[];
  /** 可选参数 */
  optionalParams: string[];
  /** 是否支持对话信道 */
  supportedInChat: boolean;
  /** 是否需要权限校验 */
  requiresAuth: boolean;
}
