/**
 * 数据访问层 - 单元测试
 * 
 * 测试 apiRequest 的去重、超时、错误处理，以及 CRUD 工厂
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// 动态导入，确保 mock 生效
let apiRequest: typeof import('@/lib/data-service').apiRequest;
let projectsApi: typeof import('@/lib/data-service').projectsApi;
let tasksApi: typeof import('@/lib/data-service').tasksApi;

beforeEach(async () => {
  vi.clearAllMocks();
  // 每次重新导入以重置 inflightRequests Map
  vi.resetModules();
  const mod = await import('@/lib/data-service');
  apiRequest = mod.apiRequest;
  projectsApi = mod.projectsApi;
  tasksApi = mod.tasksApi;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// 辅助：创建 mock Response
function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  };
}

describe('apiRequest', () => {
  describe('成功请求', () => {
    it('GET 请求应该返回 data', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '1', name: 'test' }));
      const result = await apiRequest('/api/projects');
      expect(result.data).toEqual({ id: '1', name: 'test' });
      expect(result.error).toBeUndefined();
    });

    it('POST 请求应该传递 body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'new-1' }));
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Task' }),
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Test Task' }),
        })
      );
    });

    it('应该设置 Content-Type 为 JSON', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));
      await apiRequest('/api/test');
      const callHeaders = mockFetch.mock.calls[0][1]?.headers;
      expect(callHeaders['Content-Type']).toBe('application/json');
    });
  });

  describe('GET 请求去重', () => {
    it('并发 GET 同一 URL 应该只发一次请求', async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => { resolvePromise = resolve; });

      mockFetch.mockReturnValueOnce(
        fetchPromise.then(() => mockResponse([{ id: '1' }]))
      );

      // 并发发起两个 GET
      const p1 = apiRequest('/api/dedup-test');
      const p2 = apiRequest('/api/dedup-test');

      // 释放 fetch
      resolvePromise!(undefined);

      const [r1, r2] = await Promise.all([p1, p2]);

      // 只应调用一次 fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it('POST 请求不应去重', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: '1' }))
        .mockResolvedValueOnce(mockResponse({ id: '2' }));

      const p1 = apiRequest('/api/tasks', { method: 'POST', body: '{}' });
      const p2 = apiRequest('/api/tasks', { method: 'POST', body: '{}' });

      await Promise.all([p1, p2]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('不同 URL 的 GET 不应去重', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse([]))
        .mockResolvedValueOnce(mockResponse([]));

      const p1 = apiRequest('/api/tasks');
      const p2 = apiRequest('/api/projects');

      await Promise.all([p1, p2]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理', () => {
    it('HTTP 错误应该返回 error 字段', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not Found' }, 404));
      const result = await apiRequest('/api/nonexistent');
      expect(result.error).toBe('Not Found');
      expect(result.data).toBeUndefined();
    });

    it('HTTP 错误无 JSON 体时应该返回状态码', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('no json')),
      });
      const result = await apiRequest('/api/broken');
      expect(result.error).toBe('HTTP 500');
    });

    it('网络错误应该返回错误消息', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
      const result = await apiRequest('/api/network-error');
      expect(result.error).toBe('fetch failed');
    });

    it('非 Error 异常应该返回通用消息', async () => {
      mockFetch.mockRejectedValueOnce('string error');
      const result = await apiRequest('/api/unknown-error');
      expect(result.error).toBe('Network request failed');
    });

    it('超时应该返回超时错误', async () => {
      // 模拟 AbortError
      mockFetch.mockRejectedValueOnce(
        Object.assign(new DOMException('The operation was aborted', 'AbortError'))
      );
      const result = await apiRequest('/api/timeout');
      expect(result.error).toBe('Request timeout (30s)');
    });
  });
});

describe('CRUD API Client 工厂', () => {
  describe('projectsApi', () => {
    it('getAll 应该 GET /api/projects', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([{ id: '1', name: 'P1' }]));
      const result = await projectsApi.getAll();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result.data).toEqual([{ id: '1', name: 'P1' }]);
    });

    it('create 应该 POST /api/projects', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'new-1', name: 'New' }));
      await projectsApi.create({ name: 'New' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('update 应该 PUT /api/projects/:id', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '1', name: 'Updated' }));
      await projectsApi.update('1', { name: 'Updated' } as Record<string, unknown>);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('delete 应该 DELETE /api/projects/:id', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));
      await projectsApi.delete('1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('tasksApi（带 filter）', () => {
    it('getAll 无 filter 时不带查询参数', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await tasksApi.getAll();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tasks',
        expect.anything()
      );
    });

    it('getAll 带 projectId filter', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await tasksApi.getAll({ projectId: 'proj-1' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('projectId=proj-1'),
        expect.anything()
      );
    });

    it('getAll 带多个 filter', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await tasksApi.getAll({ projectId: 'proj-1', memberId: 'mem-1' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('projectId=proj-1');
      expect(url).toContain('memberId=mem-1');
    });

    it('getAll 忽略非白名单 filter', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await tasksApi.getAll({ projectId: 'p1', unknownKey: 'val' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('projectId=p1');
      expect(url).not.toContain('unknownKey');
    });
  });
});
