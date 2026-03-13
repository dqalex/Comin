/**
 * REQ-012: 渐进式上下文设计 - 上游接口测试
 *
 * 测试目的：确保本次修改不破坏上游调用方依赖的接口
 * 覆盖范围：
 *   - 现有 MCP API 接口
 *   - 任务推送 API 接口
 *   - 文档 API 接口
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthHelper } from '@/tests/helpers/auth-helper';
import { TestDataFactory } from '@/tests/helpers/test-fixture';
import { apiPost, apiGet } from '@/tests/helpers/api-client';

describe('REQ-012: 上游接口稳定性', () => {
  let auth: AuthHelper;
  let factory: TestDataFactory;
  let testTaskId: string | null = null;

  beforeAll(async () => {
    auth = new AuthHelper();
    await auth.setup();
    
    factory = new TestDataFactory();
    factory.setAuthHeaders(auth.getAuthHeaders());

    const task = await factory.createTask({ title: '[测试] 上游接口任务' });
    testTaskId = task.id;
  });

  afterAll(async () => {
    await factory.cleanup();
  });

  // ==================== MCP API 兼容性 ====================

  describe('MCP API 接口兼容性', () => {
    it('POST /api/mcp 返回格式不变', async () => {
      const res = await apiPost('/api/mcp', {
        tool: 'list_my_tasks',
        parameters: { status: 'all' }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      
      // 返回格式应保持不变
      expect(data).toHaveProperty('success');
      expect(typeof data.success).toBe('boolean');
    });

    it('MCP get_task 接口仍支持旧调用方式', async () => {
      // 旧调用方式（不传 detail）仍应工作
      const res = await apiPost('/api/mcp', {
        tool: 'get_task',
        parameters: { task_id: testTaskId }
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const data = res.data;
      expect(data.success).toBe(true);
    });

    it('MCP get_document 接口仍支持旧调用方式', async () => {
      const doc = await factory.createDocument({ title: '[测试] MCP 文档' });

      const res = await apiPost('/api/mcp', {
        tool: 'get_document',
        parameters: { document_id: doc.id }
      }, { headers: auth.getAuthHeaders() });

      expect(res.status).toBeLessThan(500); // 不应崩溃
    });
  });

  // ==================== 任务推送 API 兼容性 ====================

  describe('任务推送 API 接口兼容性', () => {
    it('POST /api/task-push 返回格式不变', async () => {
      const res = await apiPost('/api/task-push', {
        taskId: 'non-existent-task'
      }, { headers: auth.getAuthHeaders() });

      // 应返回 400 错误，而不是 500
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error');
    });

    it('GET /api/tasks 应响应（需登录）', async () => {
      const res = await apiGet('/api/tasks', { headers: auth.getAuthHeaders() });
      expect(res.ok).toBe(true);
    });
  });

  // ==================== 文档 API 兼容性 ====================

  describe('文档 API 接口兼容性', () => {
    it('GET /api/documents 应响应（需登录）', async () => {
      const res = await apiGet('/api/documents', { headers: auth.getAuthHeaders() });
      expect(res.ok).toBe(true);
    });
  });

  // ==================== SOP API 兼容性 ====================

  describe('SOP API 接口兼容性', () => {
    it('GET /api/sop-templates 返回格式不变', async () => {
      const res = await apiGet('/api/sop-templates');
      expect(res.ok).toBe(true);
      
      const data = res.data;
      // SOP 模板直接返回数组
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
