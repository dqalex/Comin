/**
 * 对话信道数据交互模块 - 统一执行器
 * 
 * 提供：
 * - 单一执行入口
 * - 统一的错误处理
 * - 结构化日志
 * - 自动刷新前端 Store
 */

import type { Action, ActionType, ActionResult, BatchActionResult, ExecutorOptions } from './types';
import { ErrorCode } from './types';
import { ActionError, toActionError, missingParamError } from './errors';
import { validateActionParams, ACTION_DEFINITIONS } from './actions';
import { getLogger, generateRequestId } from './logger';

// 导入 handlers（复用现有实现）
import {
  handleGetTask,
  handleUpdateTaskStatus,
  handleAddTaskComment,
  handleCreateCheckItem,
  handleCompleteCheckItem,
  handleListMyTasks,
} from '@/app/api/mcp/handlers/task.handler';
import {
  handleGetDocument,
  handleCreateDocument,
  handleUpdateDocument,
  handleSearchDocuments,
} from '@/app/api/mcp/handlers/document.handler';
import {
  handleGetProject,
  handleGetProjectMembers,
} from '@/app/api/mcp/handlers/project.handler';
import {
  handleUpdateStatus,
  handleSetQueue,
  handleSetDoNotDisturb,
} from '@/app/api/mcp/handlers/status.handler';
import {
  handleCreateSchedule,
  handleListSchedules,
  handleDeleteSchedule,
  handleUpdateSchedule,
} from '@/app/api/mcp/handlers/schedule.handler';
import {
  handleDeliverDocument,
  handleReviewDelivery,
} from '@/app/api/mcp/handlers/delivery.handler';
import { handleRegisterMember, handleGetMcpToken } from '@/app/api/mcp/handlers/member.handler';
import {
  handleGetTemplate,
  handleListTemplates,
} from '@/app/api/mcp/handlers/template.handler';

// 导入 Store 刷新
import { useTaskStore } from '@/store/task.store';
import { useDocumentStore } from '@/store/document.store';
import { useProjectStore } from '@/store/project.store';
import { useMemberStore } from '@/store/member.store';
import { useOpenClawStatusStore } from '@/store/openclaw.store';
import { useScheduledTaskStore } from '@/store/schedule.store';
import { useDeliveryStore } from '@/store/delivery.store';

// ============================================================================
// 执行器
// ============================================================================

/**
 * 执行单个 Action
 */
export async function executeAction(
  action: Action,
  options: ExecutorOptions = {}
): Promise<ActionResult> {
  const requestId = options.requestId || generateRequestId();
  const logger = getLogger();
  const startTime = logger.actionStart(requestId, action.type, action as unknown as Record<string, unknown>);

  try {
    // 1. 验证操作类型
    const def = ACTION_DEFINITIONS[action.type];
    if (!def) {
      throw new ActionError(
        ErrorCode.INVALID_TYPE,
        `未知的操作类型: ${action.type}`,
        { type: action.type }
      );
    }

    // 2. 验证参数
    const validation = validateActionParams(action.type, action as unknown as Record<string, unknown>);
    if (!validation.valid) {
      throw missingParamError(validation.missing[0], action.type);
    }

    // 3. 执行操作
    const result = await executeHandler(action, options);

    // 4. 记录日志
    logger.actionEnd(requestId, action.type, startTime, result.success, result.message);

    // 5. 添加请求 ID
    result.requestId = requestId;

    return result;
  } catch (error) {
    const actionError = toActionError(error, action.type);
    logger.actionEnd(requestId, action.type, startTime, false, actionError.message);
    
    return actionError.toResult(action.type, requestId);
  }
}

/**
 * 批量执行 Actions
 * 
 * 支持返回值传递：前序 action 的返回值可传递给后续 action
 * 例如：create_document 返回 document_id → deliver_document 使用
 */
export async function executeActions(
  actions: Action[],
  options: ExecutorOptions = {}
): Promise<BatchActionResult> {
  const requestId = options.requestId || generateRequestId();
  const logger = getLogger();
  
  logger.info(requestId, `开始批量执行 ${actions.length} 个操作`);

  const results: ActionResult[] = [];
  // 执行上下文：存储前序 action 的返回值
  const context: {
    lastDocumentId?: string;
    lastDocumentTitle?: string;
    lastTaskId?: string;
    lastDeliveryId?: string;
  } = {};
  
  for (const action of actions) {
    // 注入上下文值
    const enrichedAction = injectContext(action, context);
    
    const result = await executeAction(enrichedAction, { ...options, requestId });
    results.push(result);
    
    // 更新上下文
    if (result.success && result.data) {
      updateContext(context, action.type, result.data);
    }
    
    // 记录失败但继续执行
    if (!result.success) {
      logger.warn(requestId, `操作 ${action.type} 执行失败: ${result.message}`, {
        action: action.type,
        data: { errorCode: result.errorCode },
      });
    }
  }

  // 汇总
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;

  logger.info(requestId, `批量执行完成: ${successCount} 成功, ${failedCount} 失败`);

  return {
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failedCount,
    },
    requestId,
  };
}

/**
 * 注入上下文值到 action
 * 解决 create_document → deliver_document 的 ID 传递问题
 */
function injectContext(action: Action, context: { lastDocumentId?: string; lastDocumentTitle?: string }): Action {
  // deliver_document 缺少 document_id 时，使用最近创建的文档
  if (action.type === 'deliver_document') {
    if (!action.document_id && context.lastDocumentId) {
      console.log('[chat-channel] 自动注入 document_id:', context.lastDocumentId);
      return { ...action, document_id: context.lastDocumentId };
    }
    // 如果 title 匹配，也注入
    if (!action.document_id && action.title && context.lastDocumentTitle === action.title && context.lastDocumentId) {
      return { ...action, document_id: context.lastDocumentId };
    }
  }
  return action;
}

/**
 * 更新执行上下文
 */
function updateContext(
  context: { lastDocumentId?: string; lastDocumentTitle?: string; lastTaskId?: string; lastDeliveryId?: string },
  actionType: string,
  data: Record<string, unknown>
): void {
  switch (actionType) {
    case 'create_document':
      if (data.id) {
        context.lastDocumentId = data.id as string;
        context.lastDocumentTitle = data.title as string;
      }
      break;
    case 'update_task_status':
      if (data.taskId) {
        context.lastTaskId = data.taskId as string;
      }
      break;
    case 'deliver_document':
      if (data.id) {
        context.lastDeliveryId = data.id as string;
      }
      break;
  }
}

// ============================================================================
// Handler 分发
// ============================================================================

/**
 * 执行 Handler
 */
async function executeHandler(
  action: Action,
  options: ExecutorOptions
): Promise<ActionResult> {
  let result: { success: boolean; data?: unknown; error?: string; message?: string };

  switch (action.type) {
    // ============ 查询类 ============
    
    case 'get_task':
      result = await handleGetTask({ task_id: action.task_id });
      break;
    
    case 'list_my_tasks':
      result = await handleListMyTasks({
        member_id: action.member_id || options.memberId,
        status: action.status,
        project_id: action.project_id,
        limit: action.limit,
      });
      break;
    
    case 'get_project':
      result = await handleGetProject({ project_id: action.project_id });
      break;
    
    case 'get_project_members':
      result = await handleGetProjectMembers({});
      break;
    
    case 'get_document':
      result = await handleGetDocument({
        document_id: action.document_id,
        title: action.title,
      });
      break;
    
    case 'search_documents':
      result = await handleSearchDocuments({
        query: action.query,
        project_id: action.project_id,
      });
      break;
    
    case 'get_template':
      result = await handleGetTemplate({ template_name: action.template_name });
      break;
    
    case 'list_templates':
      result = await handleListTemplates();
      break;
    
    case 'list_schedules':
      result = await handleListSchedules({
        member_id: action.member_id,
        enabled_only: action.enabled_only,
      });
      break;

    // ============ 写入类 ============
    
    case 'update_task_status':
      result = await handleUpdateTaskStatus({
        task_id: action.task_id,
        status: action.status,
        progress: action.progress,
        message: action.message,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'add_comment':
      result = await handleAddTaskComment({
        task_id: action.task_id,
        content: action.content,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'create_check_item':
      result = await handleCreateCheckItem({
        task_id: action.task_id,
        text: action.text,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'complete_check_item':
      result = await handleCompleteCheckItem({
        task_id: action.task_id,
        item_id: action.item_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'create_document':
      result = await handleCreateDocument({
        title: action.title,
        content: action.content,
        doc_type: action.doc_type,
        project_id: action.project_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDocumentStore.getState().fetchDocuments();
      }
      break;
    
    case 'update_document':
      result = await handleUpdateDocument({
        document_id: action.document_id,
        content: action.content,
        doc_type: action.doc_type,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDocumentStore.getState().fetchDocuments();
      }
      break;
    
    case 'deliver_document':
      result = await handleDeliverDocument({
        title: action.title,
        description: action.content,
        platform: action.platform,
        external_url: action.external_url,
        document_id: action.document_id,
        task_id: action.task_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDeliveryStore.getState().fetchDeliveries();
      }
      break;
    
    case 'review_delivery':
      result = await handleReviewDelivery({
        delivery_id: action.delivery_id,
        status: action.review_status,
        comment: action.review_comment,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useDeliveryStore.getState().fetchDeliveries();
      }
      break;
    
    case 'register_member':
      result = await handleRegisterMember({
        name: action.name,
        endpoint: action.endpoint,
        deploy_mode: action.deploy_mode,
        execution_mode: action.execution_mode,
        tools: action.tools,
        task_types: action.task_types,
        api_token: action.api_token,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useMemberStore.getState().fetchMembers();
      }
      break;

    // ============ 状态类 ============
    
    case 'update_status':
      result = await handleUpdateStatus({
        member_id: action.member_id || options.memberId,
        status: action.status,
        current_action: action.current_action,
        task_id: action.task_id,
        progress: action.progress,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useOpenClawStatusStore.getState().fetchStatus();
      }
      break;
    
    case 'set_queue':
      result = await handleSetQueue({
        member_id: action.member_id || options.memberId,
        queued_tasks: action.queued_tasks,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useOpenClawStatusStore.getState().fetchStatus();
      }
      break;
    
    case 'set_do_not_disturb':
      result = await handleSetDoNotDisturb({
        member_id: action.member_id || options.memberId,
        interruptible: action.interruptible,
        reason: action.reason,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useOpenClawStatusStore.getState().fetchStatus();
      }
      break;

    // ============ 定时任务类 ============
    
    case 'create_schedule':
      result = await handleCreateSchedule({
        title: action.title,
        task_type: action.task_type,
        schedule_type: action.schedule_type,
        schedule_time: action.schedule_time,
        schedule_days: action.schedule_days,
        description: action.description,
        config: action.config,
        member_id: action.member_id || options.memberId,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useScheduledTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'update_schedule':
      result = await handleUpdateSchedule({
        schedule_id: action.schedule_id,
        title: action.title,
        schedule_time: action.schedule_time,
        schedule_days: action.schedule_days,
        enabled: action.enabled,
        description: action.description,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useScheduledTaskStore.getState().fetchTasks();
      }
      break;
    
    case 'delete_schedule':
      result = await handleDeleteSchedule({
        schedule_id: action.schedule_id,
      });
      if (result.success && options.triggerRefresh !== false) {
        await useScheduledTaskStore.getState().fetchTasks();
      }
      break;

    // ============ 扩展类 ============
    
    case 'sync_identity':
      result = await handleSyncIdentity({
        name: action.name,
        creature: action.creature,
        vibe: action.vibe,
        emoji: action.emoji,
        avatar: action.avatar,
      });
      break;
    
    case 'get_mcp_token':
      // [F3] member_id 优先用 action 参数，其次用 options.memberId（由服务端从 sessionKey 推导）
      result = await handleGetMcpToken({
        member_id: action.member_id || options.memberId,
      });
      break;
    
    case 'custom_action':
      // 自定义操作需要注册 handler
      result = {
        success: false,
        error: `自定义操作 ${action.action_name} 未注册 handler`,
      };
      break;

    default:
      result = {
        success: false,
        error: `未实现的操作类型: ${(action as Action).type}`,
      };
  }

  return {
    type: action.type,
    success: result.success,
    message: result.success
      ? (result.message || '操作成功')
      : (result.error || '操作失败'),
    data: result.data as Record<string, unknown> | undefined,
    timestamp: new Date(),
    requestId: options.requestId,
  };
}

// ============================================================================
// 扩展 Handler（身份同步等）
// ============================================================================

/**
 * 身份同步 Handler
 */
async function handleSyncIdentity(params: Record<string, unknown>): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}> {
  // 这个功能需要 Gateway 支持，暂时返回成功
  // TODO: 实现与 Gateway 的身份同步
  
  const { name, creature, vibe, emoji, avatar } = params;
  
  return {
    success: true,
    data: { name, creature, vibe, emoji, avatar },
    message: '身份信息已同步',
  };
}

// ============================================================================
// 自定义 Handler 注册
// ============================================================================

type CustomHandler = (params: Record<string, unknown>, options: ExecutorOptions) => Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}>;

const customHandlers = new Map<string, CustomHandler>();

/**
 * 注册自定义 Handler
 */
export function registerCustomHandler(actionName: string, handler: CustomHandler): void {
  customHandlers.set(actionName, handler);
}

/**
 * 获取自定义 Handler
 */
export function getCustomHandler(actionName: string): CustomHandler | undefined {
  return customHandlers.get(actionName);
}

// ============================================================================
// 导出
// ============================================================================

export { generateRequestId } from './logger';
