/**
 * 对话信道数据交互模块 - 客户端入口
 * 
 * 只导出客户端安全的函数（解析器）
 * 执行器相关功能请使用服务端入口或 API
 * 
 * @example
 * // 在客户端组件中
 * import { parseChatActions, hasChatActions } from '@/lib/chat-channel/client';
 */

// ============ 类型定义 ============
export type {
  Action,
  ActionType,
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
} from './types';

// ============ 解析器（客户端安全）============
export {
  parseChatActions,
  hasChatActions,
  extractActionJson,
  parseLooseActions,
  buildActionsJson,
  mergeActions,
} from './parser';

// ============ Action 定义（只读，客户端安全）============
export {
  ACTION_DEFINITIONS,
  getChatSupportedActions,
  isChatSupported,
  getActionDescription,
} from './actions';
