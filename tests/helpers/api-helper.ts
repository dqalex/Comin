/**
 * E2E 测试 API 调用辅助工具
 * 解决 page.request 不携带 Cookie 的问题
 */

import type { Page } from '@playwright/test';

export interface ApiCallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T | null;
  error?: string;
}

/**
 * 统一的 API 调用方法，自动携带 Cookie
 */
export async function apiCall<T = unknown>(
  page: Page,
  options: ApiCallOptions
): Promise<ApiResponse<T>> {
  // 确保页面已加载，避免 window.location.origin 为 null
  if (page.url() === 'about:blank' || !page.url().startsWith('http')) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  }

  return page.evaluate(
    async ({ method, path, body }) => {
      const url = `${window.location.origin}${path}`;
      
      try {
        const response = await fetch(url, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'include',
        });

        let data: T | null = null;
        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : null;
        } catch {
          // 响应体非 JSON
        }

        return {
          status: response.status,
          ok: response.ok,
          data,
        };
      } catch (error) {
        return {
          status: 0,
          ok: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    options
  );
}

/**
 * GET 请求
 */
export async function apiGet<T = unknown>(
  page: Page,
  path: string
): Promise<ApiResponse<T>> {
  return apiCall<T>(page, { method: 'GET', path });
}

/**
 * POST 请求
 */
export async function apiPost<T = unknown>(
  page: Page,
  path: string,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiCall<T>(page, { method: 'POST', path, body });
}

/**
 * PUT 请求
 */
export async function apiPut<T = unknown>(
  page: Page,
  path: string,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiCall<T>(page, { method: 'PUT', path, body });
}

/**
 * DELETE 请求
 */
export async function apiDelete<T = unknown>(
  page: Page,
  path: string
): Promise<ApiResponse<T>> {
  return apiCall<T>(page, { method: 'DELETE', path });
}

/**
 * 测试数据工厂基类
 */
export class TestApiFactory {
  constructor(protected page: Page) {}

  protected async post<T>(path: string, body: unknown): Promise<T> {
    const result = await apiPost<{ data: T } | T>(this.page, path, body);
    if (!result.ok) {
      throw new Error(`API POST ${path} failed: ${result.status}`);
    }
    // 处理 { data: T } 和裸 T 两种格式
    const data = result.data;
    return (data as { data: T }).data !== undefined 
      ? (data as { data: T }).data 
      : data as T;
  }

  protected async get<T>(path: string): Promise<T> {
    const result = await apiGet<{ data: T } | T>(this.page, path);
    if (!result.ok) {
      throw new Error(`API GET ${path} failed: ${result.status}`);
    }
    const data = result.data;
    return (data as { data: T }).data !== undefined 
      ? (data as { data: T }).data 
      : data as T;
  }

  protected async put<T>(path: string, body: unknown): Promise<T> {
    const result = await apiPut<{ data: T } | T>(this.page, path, body);
    if (!result.ok) {
      throw new Error(`API PUT ${path} failed: ${result.status}`);
    }
    const data = result.data;
    return (data as { data: T }).data !== undefined 
      ? (data as { data: T }).data 
      : data as T;
  }

  protected async delete(path: string): Promise<void> {
    const result = await apiDelete(this.page, path);
    if (!result.ok && result.status !== 404) {
      throw new Error(`API DELETE ${path} failed: ${result.status}`);
    }
  }
}
