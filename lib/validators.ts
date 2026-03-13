/**
 * 通用输入校验工具
 * 枚举值必须与 db/schema.ts 中的定义严格一致
 */

// ==================== 格式验证 ====================

/**
 * 验证 ID 格式
 */
export function isValidId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // UUID v4 格式或自定义 ID 格式
  return /^[a-zA-Z0-9_-]+$/.test(value) && value.length >= 1 && value.length <= 100;
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(value: unknown, allowedProtocols: string[] = ['http:', 'https:']): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return allowedProtocols.includes(url.protocol);
  } catch {
    return false;
  }
}

// ==================== 请求限制 ====================

/**
 * 请求体大小限制配置
 */
export const REQUEST_LIMITS = {
  // API 请求体最大 1MB
  MAX_BODY_SIZE: 1024 * 1024,
  // 字符串字段最大 10KB
  MAX_STRING_LENGTH: 10 * 1024,
  // 数组最大元素数
  MAX_ARRAY_LENGTH: 1000,
  // 嵌套深度
  MAX_NESTING_DEPTH: 10,
} as const;

/**
 * 验证请求体大小
 */
export function validateRequestBodySize(body: unknown, maxSize: number = REQUEST_LIMITS.MAX_BODY_SIZE): boolean {
  try {
    const size = JSON.stringify(body).length;
    return size <= maxSize;
  } catch {
    return false;
  }
}

// ==================== 枚举校验 ====================

export const VALID_TASK_STATUS = ['todo', 'in_progress', 'reviewing', 'completed'] as const;
export type TaskStatus = typeof VALID_TASK_STATUS[number];

export const VALID_PRIORITY = ['high', 'medium', 'low'] as const;
export type TaskPriority = typeof VALID_PRIORITY[number];

export const VALID_CHAT_ROLE = ['user', 'assistant', 'system'] as const;
export type ChatRole = typeof VALID_CHAT_ROLE[number];

export const VALID_MESSAGE_STATUS = ['sending', 'sent', 'error'] as const;
export type MessageStatus = typeof VALID_MESSAGE_STATUS[number];

export const VALID_HISTORY_STATUS = ['running', 'success', 'failed', 'skipped'] as const;
export type HistoryStatus = typeof VALID_HISTORY_STATUS[number];

export const VALID_LAST_RUN_STATUS = ['success', 'failed', 'skipped'] as const;
export type LastRunStatus = typeof VALID_LAST_RUN_STATUS[number];

export const VALID_SCHEDULE_TYPE = ['once', 'daily', 'weekly', 'monthly'] as const;
export type ScheduleType = typeof VALID_SCHEDULE_TYPE[number];

export const VALID_TASK_TYPE = ['report', 'summary', 'backup', 'notification', 'custom'] as const;
export type ScheduleTaskType = typeof VALID_TASK_TYPE[number];

export const VALID_DELIVERY_STATUS = ['pending', 'approved', 'rejected', 'revision_needed'] as const;
export type DeliveryStatus = typeof VALID_DELIVERY_STATUS[number];

export const VALID_MILESTONE_STATUS = ['open', 'in_progress', 'completed', 'cancelled'] as const;
export type MilestoneStatus = typeof VALID_MILESTONE_STATUS[number];

export const VALID_DELIVERY_PLATFORM = ['tencent-doc', 'feishu', 'notion', 'local', 'other'] as const;
export type DeliveryPlatform = typeof VALID_DELIVERY_PLATFORM[number];

export const VALID_MEMBER_TYPE = ['human', 'ai'] as const;
export type MemberType = typeof VALID_MEMBER_TYPE[number];

export const VALID_DEPLOY_MODE = ['cloud', 'local', 'knot'] as const;
export type DeployMode = typeof VALID_DEPLOY_MODE[number];

export const VALID_CONNECTION_STATUS = ['connected', 'disconnected', 'error'] as const;
export type ConnectionStatus = typeof VALID_CONNECTION_STATUS[number];

export const VALID_CONFIG_SOURCE = ['manual', 'self'] as const;
export type ConfigSource = typeof VALID_CONFIG_SOURCE[number];

export const VALID_EXECUTION_MODE = ['chat_only', 'api_first', 'api_only'] as const;
export type ExecutionMode = typeof VALID_EXECUTION_MODE[number];

export const VALID_DOC_SOURCE = ['local', 'external', 'openclaw'] as const;
export type DocSource = typeof VALID_DOC_SOURCE[number];

export const VALID_EXTERNAL_PLATFORM = ['notion', 'feishu', 'tencent-doc', 'yuque', 'google-docs', 'other'] as const;
export type ExternalPlatform = typeof VALID_EXTERNAL_PLATFORM[number];

export const VALID_SYNC_MODE = ['realtime', 'cached'] as const;
export type SyncMode = typeof VALID_SYNC_MODE[number];

export const VALID_DOC_TYPE = ['guide', 'reference', 'report', 'note', 'decision', 'scheduled_task', 'task_list', 'blog', 'other'] as const;
export type DocType = typeof VALID_DOC_TYPE[number];

export const VALID_OPENCLAW_STATUS = ['idle', 'working', 'waiting', 'offline'] as const;
export type OpenClawStatusType = typeof VALID_OPENCLAW_STATUS[number];

export const VALID_DELIVERABLE_TYPE = ['document', 'notification', 'data', 'none'] as const;
export type DeliverableType = typeof VALID_DELIVERABLE_TYPE[number];

export const VALID_ENTITY_TYPE = ['task', 'scheduled_task', 'project'] as const;
export type EntityType = typeof VALID_ENTITY_TYPE[number];

export function validateEnum<T extends string>(
  value: unknown,
  validValues: readonly T[]
): T | null {
  if (typeof value !== 'string') return null;
  return validValues.includes(value as T) ? (value as T) : null;
}

export function validateEnumWithDefault<T extends string>(
  value: unknown,
  validValues: readonly T[],
  defaultValue: T
): T {
  return validateEnum(value, validValues) ?? defaultValue;
}
