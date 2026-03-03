/**
 * 对话信道数据交互模块
 * 
 * 统一 Chat Actions 和 MCP Tools，提供：
 * - 单一执行入口
 * - 统一类型定义
 * - 结构化日志
 * - 完整错误处理
 * 
 * @example
 * // 解析对话中的 actions
 * import { parseChatActions } from '@/lib/chat-channel';
 * const { actions, cleanContent } = parseChatActions(aiReply);
 * 
 * @example
 * // 执行 actions
 * import { executeActions } from '@/lib/chat-channel';
 * const result = await executeActions(actions, { memberId: 'member-xxx' });
 */

// ============ 类型定义 ============
export type {
  Action,
  ActionType,
  ActionResult,
  BatchActionResult,
  ExecutorOptions,
  ParseResult,
  UnrecognizedAction,
  TaskStatus,
  TaskPriority,
  AIStatus,
  DocType,
  DeliveryPlatform,
  ReviewStatus,
  ScheduleType,
  ScheduleTaskType,
  LogLevel,
  LogEntry,
  ActionDefinition,
} from './types';

export { ErrorCode, ActionError as ActionErrorClass } from './types';

// ============ 错误处理 ============
export {
  ActionError,
  ParamError,
  NotFoundError,
  PermissionError,
  TimeoutError,
  NetworkError,
  missingParamError,
  invalidParamError,
  unknownActionError,
  executionError,
  databaseError,
  toActionError,
  isRetryable,
  getRetryDelay,
  formatErrorForUser,
} from './errors';

// ============ Action 定义 ============
export {
  ACTION_DEFINITIONS,
  getChatSupportedActions,
  isChatSupported,
  validateActionParams,
  getActionDescription,
} from './actions';

// ============ 解析器 ============
export {
  parseChatActions,
  hasChatActions,
  extractActionJson,
  parseLooseActions,
  buildActionsJson,
  mergeActions,
} from './parser';

// ============ 执行器 ============
export {
  executeAction,
  executeActions,
  registerCustomHandler,
  getCustomHandler,
} from './executor';

// ============ 日志 ============
export {
  ChannelLogger,
  getLogger,
  configureLogger,
  generateRequestId,
} from './logger';
