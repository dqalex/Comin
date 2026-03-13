/**
 * API 工具函数
 * 
 * 提供统一的 API 响应格式和错误处理
 */

import { NextResponse } from 'next/server';

// ==================== 响应类型 ====================

/** API 错误响应格式 */
export interface ApiErrorResponse {
  error: string;
  details?: unknown;
}

/** API 成功响应格式 */
export interface ApiSuccessResponse<T = unknown> {
  data: T;
}

/** 分页响应格式 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ==================== 响应构造器 ====================

/** 成功响应 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** 创建成功响应 (201) */
export function apiCreated<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

/** 无内容响应 (204) */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/** 错误响应 */
export function apiError(message: string, status = 500, details?: unknown): NextResponse {
  const body: ApiErrorResponse = { error: message };
  if (details !== undefined) {
    body.details = details;
  }
  
  // 开发环境打印错误日志
  if (process.env.NODE_ENV === 'development') {
    console.error(`[API Error ${status}]`, message, details || '');
  }
  
  return NextResponse.json(body, { status });
}

// ==================== 标准错误响应 ====================

/** 400 Bad Request */
export function badRequest(message: string, details?: unknown): NextResponse {
  return apiError(message, 400, details);
}

/** 401 Unauthorized */
export function unauthorized(message = 'Unauthorized'): NextResponse {
  return apiError(message, 401);
}

/** 403 Forbidden */
export function forbidden(message = 'Forbidden'): NextResponse {
  return apiError(message, 403);
}

/** 404 Not Found */
export function notFound(resource = 'Resource'): NextResponse {
  return apiError(`${resource} not found`, 404);
}

/** 409 Conflict */
export function conflict(message: string): NextResponse {
  return apiError(message, 409);
}

/** 422 Unprocessable Entity */
export function unprocessable(message: string, details?: unknown): NextResponse {
  return apiError(message, 422, details);
}

/** 500 Internal Server Error */
export function serverError(message = 'Internal server error', error?: unknown): NextResponse {
  return apiError(message, 500, error);
}

// ==================== 辅助函数 ====================

/** 包装异步处理函数，自动捕获异常 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((err) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return serverError(message, process.env.NODE_ENV === 'development' ? err : undefined) as NextResponse<ApiErrorResponse>;
  });
}

/** 验证必填字段 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): { valid: true } | { valid: false; response: NextResponse } {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length > 0) {
    return { valid: false, response: badRequest(`Missing required fields: ${missing.join(', ')}`) };
  }
  return { valid: true };
}

/** 验证 ID 格式（Base58 短 ID） */
export function validateId(id: string | undefined, name = 'ID'): { valid: true } | { valid: false; response: NextResponse } {
  if (!id || typeof id !== 'string') {
    return { valid: false, response: badRequest(`Invalid ${name}: missing`) };
  }
  // Base58 字符集（不含 0, O, I, l）
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  if (!base58Regex.test(id)) {
    return { valid: false, response: badRequest(`Invalid ${name} format`) };
  }
  return { valid: true };
}
