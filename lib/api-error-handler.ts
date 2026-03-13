/**
 * API 统一错误处理器
 * 
 * 提供标准化的错误响应格式，避免在生产环境暴露技术细节
 */

import { NextResponse } from 'next/server';

// ============================================================
// 类型定义
// ============================================================

export interface ApiErrorResponse {
  error: string;
  code?: string;
  requestId?: string;
  details?: Record<string, unknown>; // 仅开发环境
}

export interface ApiErrorOptions {
  status?: number;
  code?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  log?: boolean;
}

// ============================================================
// 错误代码枚举
// ============================================================

export const ErrorCodes = {
  // 400 Bad Request
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // 409 Conflict
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // 422 Unprocessable Entity
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  
  // 429 Too Many Requests
  RATE_LIMITED: 'RATE_LIMITED',
  
  // 500 Internal Server Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// ============================================================
// 核心函数
// ============================================================

/**
 * 处理 API 错误，返回标准化错误响应
 * 
 * @param error 错误对象
 * @param options 配置选项
 * @returns NextResponse
 */
export function handleApiError(
  error: unknown,
  options: ApiErrorOptions = {}
): NextResponse<ApiErrorResponse> {
  const {
    status = 500,
    code = ErrorCodes.INTERNAL_ERROR,
    requestId,
    details,
    log = true,
  } = options;

  // 提取错误消息
  let message: string;
  let internalDetails: Record<string, unknown> | undefined;
  
  if (error instanceof Error) {
    message = error.message;
    internalDetails = {
      name: error.name,
      stack: error.stack,
    };
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'An unexpected error occurred';
  }

  // 日志记录（服务端）
  if (log && typeof window === 'undefined') {
    const logPrefix = requestId ? `[${requestId}]` : '[API Error]';
    console.error(`${logPrefix} ${code}: ${message}`, error);
  }

  // 构建响应体
  const isProduction = process.env.NODE_ENV === 'production';
  
  const responseBody: ApiErrorResponse = {
    error: isProduction && status >= 500 
      ? 'An unexpected error occurred' 
      : message,
    code,
    requestId,
  };

  // 开发环境添加详细信息
  if (!isProduction && (details || internalDetails)) {
    responseBody.details = { ...details, ...internalDetails };
  }

  return NextResponse.json(responseBody, { status });
}

/**
 * 创建验证错误响应 (400)
 */
export function validationError(
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    status: 400,
    code: ErrorCodes.VALIDATION_ERROR,
    requestId,
    details,
    log: false,
  });
}

/**
 * 创建未授权响应 (401)
 */
export function unauthorizedError(
  message = 'Authentication required',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    status: 401,
    code: ErrorCodes.UNAUTHORIZED,
    requestId,
    log: false,
  });
}

/**
 * 创建禁止访问响应 (403)
 */
export function forbiddenError(
  message = 'Access denied',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    status: 403,
    code: ErrorCodes.FORBIDDEN,
    requestId,
    log: false,
  });
}

/**
 * 创建资源未找到响应 (404)
 */
export function notFoundError(
  message = 'Resource not found',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    status: 404,
    code: ErrorCodes.NOT_FOUND,
    requestId,
    log: false,
  });
}

/**
 * 创建冲突响应 (409)
 */
export function conflictError(
  message: string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    status: 409,
    code: ErrorCodes.CONFLICT,
    requestId,
    log: false,
  });
}

/**
 * 创建限流响应 (429)
 */
export function rateLimitError(
  retryAfter?: number,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  const response = handleApiError(
    new Error('Too many requests, please try again later'),
    {
      status: 429,
      code: ErrorCodes.RATE_LIMITED,
      requestId,
      log: false,
    }
  );
  
  if (retryAfter) {
    response.headers.set('Retry-After', String(retryAfter));
  }
  
  return response;
}

/**
 * 创建服务器错误响应 (500)
 */
export function serverError(
  error: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return handleApiError(error, {
    status: 500,
    code: ErrorCodes.INTERNAL_ERROR,
    requestId,
    log: true,
  });
}

/**
 * 包装异步 API 处理函数，自动捕获错误
 * 
 * @example
 * ```ts
 * export const GET = withErrorHandling(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withErrorHandling<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse<ApiErrorResponse>> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      // 尝试从 request 中提取 requestId
      const request = args[0] as Request | undefined;
      const requestId = request?.headers.get('X-Request-Id') || undefined;
      
      return handleApiError(error, { requestId });
    }
  };
}
