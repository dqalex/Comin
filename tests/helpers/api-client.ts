/**
 * 测试用统一 HTTP 客户端
 *
 * 通过环境变量 TEST_TARGET 切换本地/远程环境：
 *   - 默认（local）：http://localhost:3000
 *   - remote：http://localhost:8000（SSH 隧道映射生产服务器）
 *
 * 使用方式：
 *   import { getBaseUrl, apiGet, apiPost, apiPut, apiDelete } from '@/tests/helpers/api-client';
 */

// 环境配置
const TARGETS = {
  local: `http://localhost:${process.env.TEST_PORT || '3000'}`,
  remote: 'http://localhost:8000', // SSH 隧道：ssh -L 8000:localhost:3000 root@43.167.204.230
} as const;

type TestTarget = keyof typeof TARGETS;

/**
 * 获取当前测试目标的 Base URL
 */
export function getBaseUrl(): string {
  const target = (process.env.TEST_TARGET || 'local') as TestTarget;
  const url = TARGETS[target];
  if (!url) {
    throw new Error(
      `未知的 TEST_TARGET: "${target}"，可选值: ${Object.keys(TARGETS).join(', ')}`
    );
  }
  return url;
}

/**
 * 获取当前测试环境名称
 */
export function getTargetName(): string {
  return process.env.TEST_TARGET || 'local';
}

/**
 * 判断是否为远程测试
 */
export function isRemoteTarget(): boolean {
  return process.env.TEST_TARGET === 'remote';
}

// 通用请求选项
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

// 统一响应类型
export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
  elapsed: number; // 请求耗时（ms）
}

/**
 * 发起 GET 请求
 */
export async function apiGet<T = unknown>(
  path: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>('GET', path, undefined, options);
}

/**
 * 发起 POST 请求
 */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>('POST', path, body, options);
}

/**
 * 发起 PUT 请求
 */
export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>('PUT', path, body, options);
}

/**
 * 发起 DELETE 请求
 */
export async function apiDelete<T = unknown>(
  path: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>('DELETE', path, undefined, options);
}

/**
 * 通用请求方法
 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  const timeout = options?.timeout ?? 10000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const start = Date.now();

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const elapsed = Date.now() - start;
    let data: T;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json() as T;
    } else {
      data = (await res.text()) as unknown as T;
    }

    return { status: res.status, ok: res.ok, data, headers: res.headers, elapsed };
  } catch (error) {
    const elapsed = Date.now() - start;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout}ms): ${method} ${url}`);
    }
    throw new Error(
      `请求失败: ${method} ${url} [${elapsed}ms] - ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 检查服务是否可达
 */
export async function checkServiceHealth(): Promise<{
  reachable: boolean;
  target: string;
  url: string;
  elapsed?: number;
  error?: string;
}> {
  const target = getTargetName();
  const baseUrl = getBaseUrl();

  try {
    const res = await apiGet('/api/health', { timeout: 5000 });
    return {
      reachable: res.ok,
      target,
      url: baseUrl,
      elapsed: res.elapsed,
    };
  } catch (error) {
    return {
      reachable: false,
      target,
      url: baseUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
