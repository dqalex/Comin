/**
 * API 错误常量 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import { API_ERRORS, createErrorResponse } from '@/lib/api-errors';
import type { ApiErrorKey } from '@/lib/api-errors';

describe('API_ERRORS 常量', () => {
  it('所有错误键应该是 errors. 前缀的 i18n 格式', () => {
    for (const [key, value] of Object.entries(API_ERRORS)) {
      expect(value, `${key} 的值应该以 errors. 开头`).toMatch(/^errors\./);
    }
  });

  it('所有错误键不应有重复值', () => {
    const values = Object.values(API_ERRORS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('应该包含通用错误', () => {
    expect(API_ERRORS.NOT_FOUND).toBeDefined();
    expect(API_ERRORS.INVALID_INPUT).toBeDefined();
    expect(API_ERRORS.UNAUTHORIZED).toBeDefined();
    expect(API_ERRORS.FORBIDDEN).toBeDefined();
    expect(API_ERRORS.INTERNAL_ERROR).toBeDefined();
  });

  it('应该包含资源特定错误', () => {
    expect(API_ERRORS.TASK_NOT_FOUND).toBeDefined();
    expect(API_ERRORS.MEMBER_NOT_FOUND).toBeDefined();
    expect(API_ERRORS.PROJECT_NOT_FOUND).toBeDefined();
    expect(API_ERRORS.DOCUMENT_NOT_FOUND).toBeDefined();
    expect(API_ERRORS.DELIVERY_NOT_FOUND).toBeDefined();
  });

  it('应该包含验证错误', () => {
    expect(API_ERRORS.TITLE_REQUIRED).toBeDefined();
    expect(API_ERRORS.MEMBER_ID_REQUIRED).toBeDefined();
    expect(API_ERRORS.INVALID_STATUS).toBeDefined();
    expect(API_ERRORS.INVALID_PRIORITY).toBeDefined();
  });

  it('应该包含操作错误', () => {
    expect(API_ERRORS.CREATE_FAILED).toBeDefined();
    expect(API_ERRORS.UPDATE_FAILED).toBeDefined();
    expect(API_ERRORS.DELETE_FAILED).toBeDefined();
    expect(API_ERRORS.FETCH_FAILED).toBeDefined();
  });

  it('应该包含业务特定错误', () => {
    expect(API_ERRORS.LOCAL_DOC_REQUIRES_DOC_ID).toBeDefined();
    expect(API_ERRORS.EXTERNAL_DOC_REQUIRES_URL).toBeDefined();
    expect(API_ERRORS.WORKSPACE_NOT_FOUND).toBeDefined();
    expect(API_ERRORS.SYNC_FAILED).toBeDefined();
  });
});

describe('createErrorResponse', () => {
  it('应该返回包含 error 字段的对象', () => {
    const result = createErrorResponse(API_ERRORS.NOT_FOUND);
    expect(result).toEqual({ error: 'errors.notFound' });
  });

  it('应该原样保留 errorKey', () => {
    const result = createErrorResponse(API_ERRORS.TASK_NOT_FOUND);
    expect(result.error).toBe('errors.taskNotFound');
  });

  it('应该接受自定义 status 参数（不影响返回值）', () => {
    const result404 = createErrorResponse(API_ERRORS.NOT_FOUND, 404);
    const result400 = createErrorResponse(API_ERRORS.NOT_FOUND, 400);
    // createErrorResponse 当前只返回 { error }，status 参数是预留的
    expect(result404).toEqual(result400);
  });

  it('应该返回新对象（不可变）', () => {
    const r1 = createErrorResponse(API_ERRORS.NOT_FOUND);
    const r2 = createErrorResponse(API_ERRORS.NOT_FOUND);
    expect(r1).not.toBe(r2);
    expect(r1).toEqual(r2);
  });
});
