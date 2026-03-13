/**
 * 对话信道数据交互模块 - 错误处理
 * 
 * 提供：
 * - 统一错误类型
 * - 错误工厂函数
 * - 错误恢复建议
 */

import { ErrorCode, type ActionType, type ActionResult } from './types';

// ============================================================================
// 错误类型
// ============================================================================

/**
 * 基础操作错误
 */
export class ActionError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ActionError';
  }

  /**
   * 转换为 ActionResult
   */
  toResult(type: ActionType, requestId?: string): ActionResult {
    return {
      type,
      success: false,
      message: this.message,
      errorCode: this.code,
      timestamp: new Date(),
      requestId,
      data: this.details,
    };
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.INVALID_PARAMS:
        return '参数格式不正确，请检查输入';
      case ErrorCode.MISSING_REQUIRED:
        return '缺少必要的参数';
      case ErrorCode.INVALID_TYPE:
        return '不支持的操作类型';
      case ErrorCode.NOT_FOUND:
        return '找不到指定的资源';
      case ErrorCode.ALREADY_EXISTS:
        return '资源已存在';
      case ErrorCode.UNAUTHORIZED:
        return '未授权，请先登录';
      case ErrorCode.FORBIDDEN:
        return '没有权限执行此操作';
      case ErrorCode.EXECUTION_FAILED:
        return '操作执行失败，请稍后重试';
      case ErrorCode.TIMEOUT:
        return '操作超时，请稍后重试';
      case ErrorCode.NETWORK_ERROR:
        return '网络错误，请检查网络连接';
      case ErrorCode.INTERNAL_ERROR:
        return '系统内部错误，请联系管理员';
      case ErrorCode.DATABASE_ERROR:
        return '数据库错误，请稍后重试';
      default:
        return '未知错误';
    }
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string {
    switch (this.code) {
      case ErrorCode.INVALID_PARAMS:
        return '请检查参数格式是否正确';
      case ErrorCode.MISSING_REQUIRED:
        return '请确保所有必填参数都已提供';
      case ErrorCode.NOT_FOUND:
        return '请确认资源 ID 是否正确';
      case ErrorCode.UNAUTHORIZED:
        return '请检查 API Token 是否正确';
      case ErrorCode.FORBIDDEN:
        return '请检查是否有操作权限';
      case ErrorCode.TIMEOUT:
        return '请稍后重试，或检查网络连接';
      case ErrorCode.NETWORK_ERROR:
        return '请检查网络连接后重试';
      default:
        return '请重试或联系技术支持';
    }
  }
}

/**
 * 参数错误
 */
export class ParamError extends ActionError {
  constructor(
    public readonly paramName: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.INVALID_PARAMS, message, { paramName, ...details });
    this.name = 'ParamError';
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends ActionError {
  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string
  ) {
    super(ErrorCode.NOT_FOUND, `${resourceType} 不存在: ${resourceId}`, {
      resourceType,
      resourceId,
    });
    this.name = 'NotFoundError';
  }
}

/**
 * 权限错误
 */
export class PermissionError extends ActionError {
  constructor(
    message: string,
    public readonly requiredPermission?: string
  ) {
    super(ErrorCode.FORBIDDEN, message, { requiredPermission });
    this.name = 'PermissionError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends ActionError {
  constructor(
    public readonly timeoutMs: number,
    public readonly operation: string
  ) {
    super(ErrorCode.TIMEOUT, `操作超时 (${timeoutMs}ms): ${operation}`, {
      timeoutMs,
      operation,
    });
    this.name = 'TimeoutError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends ActionError {
  constructor(
    public readonly originalError: Error,
    public readonly endpoint?: string
  ) {
    super(ErrorCode.NETWORK_ERROR, `网络错误: ${originalError.message}`, {
      endpoint,
      originalMessage: originalError.message,
    });
    this.name = 'NetworkError';
  }
}

// ============================================================================
// 错误工厂函数
// ============================================================================

/**
 * 创建参数缺失错误
 */
export function missingParamError(paramName: string, actionType: ActionType): ActionError {
  return new ActionError(
    ErrorCode.MISSING_REQUIRED,
    `操作 ${actionType} 缺少必填参数: ${paramName}`,
    { paramName, actionType }
  );
}

/**
 * 创建无效参数错误
 */
export function invalidParamError(
  paramName: string,
  expectedType: string,
  actualValue: unknown,
  actionType: ActionType
): ActionError {
  return new ActionError(
    ErrorCode.INVALID_PARAMS,
    `参数 ${paramName} 类型错误，期望 ${expectedType}，实际 ${typeof actualValue}`,
    { paramName, expectedType, actualType: String(actualValue), actionType }
  );
}

/**
 * 创建未知操作类型错误
 */
export function unknownActionError(type: string): ActionError {
  return new ActionError(
    ErrorCode.INVALID_TYPE,
    `未知的操作类型: ${type}`,
    { type }
  );
}

/**
 * 创建执行失败错误
 */
export function executionError(
  actionType: ActionType,
  reason: string,
  originalError?: Error
): ActionError {
  return new ActionError(
    ErrorCode.EXECUTION_FAILED,
    `操作 ${actionType} 执行失败: ${reason}`,
    { actionType, reason, originalError: originalError?.message }
  );
}

/**
 * 创建数据库错误
 */
export function databaseError(
  operation: string,
  originalError: Error
): ActionError {
  return new ActionError(
    ErrorCode.DATABASE_ERROR,
    `数据库操作失败: ${operation}`,
    { operation, error: originalError.message }
  );
}

// ============================================================================
// 错误处理工具
// ============================================================================

/**
 * 从未知错误转换为 ActionError
 */
export function toActionError(error: unknown, actionType: ActionType): ActionError {
  if (error instanceof ActionError) {
    return error;
  }
  
  if (error instanceof Error) {
    // 检查是否是网络错误
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new NetworkError(error);
    }
    
    // 检查是否是超时
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return new TimeoutError(30000, actionType);
    }
    
    // 默认为执行错误
    return executionError(actionType, error.message, error);
  }
  
  // 未知错误
  return new ActionError(
    ErrorCode.UNKNOWN,
    `未知错误: ${String(error)}`,
    { originalError: String(error) }
  );
}

/**
 * 判断错误是否可重试
 */
export function isRetryable(error: ActionError): boolean {
  const retryableCodes = [
    ErrorCode.TIMEOUT,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.EXECUTION_FAILED,
    ErrorCode.DATABASE_ERROR,
  ];
  return retryableCodes.includes(error.code);
}

/**
 * 获取重试延迟（毫秒）
 */
export function getRetryDelay(attempt: number): number {
  // 指数退避：1s, 2s, 4s, 8s
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * 格式化错误为用户消息
 */
export function formatErrorForUser(error: ActionError, includeDetails: boolean = false): string {
  let message = error.getUserMessage();
  
  if (includeDetails && error.details) {
    const details = Object.entries(error.details)
      .filter(([key]) => !key.includes('token') && !key.includes('password'))
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    if (details) {
      message += ` (${details})`;
    }
  }
  
  return message;
}
