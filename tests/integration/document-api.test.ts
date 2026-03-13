/**
 * 文档 API 集成测试
 *
 * 测试覆盖：
 * 1. 文档 CRUD
 * 2. 文档搜索
 * 3. 文档类型
 * 4. Wiki 渲染
 *
 * 运行方式：
 *   npx vitest run tests/integration/document-api.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete } from '../helpers/api-client';
import { AuthHelper, setupAuth } from '../helpers/auth-helper';
import { TestDataFactory } from '../helpers/test-fixture';

describe('文档 API 集成测试', () => {
  let auth: AuthHelper;
  let factory: TestDataFactory;
  let testDocId: string;

  beforeAll(async () => {
    auth = await setupAuth('member');
    factory = new TestDataFactory();
    factory.setAuthHeaders(auth.getAuthHeaders());
  });

  afterAll(async () => {
    await factory.cleanup();
    await auth.logout();
  });

  // ==================== 文档 CRUD ====================

  describe('1. 文档 CRUD', () => {
    it('1.1 应该能创建文档', async () => {
      const doc = await factory.createDocument({
        title: '[测试] CRUD 测试文档',
        content: '# 测试文档\n\n这是一个测试文档的内容。',
        type: 'note',
      });

      expect(doc.id).toBeDefined();
      expect(doc.title).toContain('[测试]');
      testDocId = doc.id;

      console.log(`[创建文档] id=${doc.id}`);
    });

    it('1.2 应该能获取文档列表', async () => {
      const res = await apiGet('/api/documents', { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const docs = Array.isArray(res.data) ? res.data : (res.data as { data: unknown[] }).data;
      expect(Array.isArray(docs)).toBe(true);
    });

    it('1.3 应该能获取单个文档', async () => {
      if (!testDocId) {
        throw new Error('文档 ID 未设置');
      }

      const res = await apiGet(`/api/documents/${testDocId}`, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const doc = res.data as { id: string; title: string; content: string };
      expect(doc.id).toBe(testDocId);
      expect(doc.content).toContain('测试文档');
    });

    it('1.4 应该能更新文档', async () => {
      if (!testDocId) {
        throw new Error('文档 ID 未设置');
      }

      const res = await apiPut(`/api/documents/${testDocId}`, {
        title: '[测试] 已更新的文档标题',
        content: '# 更新的内容\n\n这是更新后的内容。',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });

    it('1.5 应该能删除文档', async () => {
      // 创建一个专门用于删除的文档
      const doc = await factory.createDocument({
        title: '[测试] 待删除文档',
      });

      const res = await apiDelete(`/api/documents/${doc.id}`, { headers: auth.getAuthHeaders() });
      expect(res.ok).toBe(true);

      // 验证已删除
      const getRes = await apiGet(`/api/documents/${doc.id}`, { headers: auth.getAuthHeaders() });
      expect(getRes.status).toBe(404);
    });
  });

  // ==================== 文档类型 ====================

  describe('2. 文档类型', () => {
    const docTypes: Array<'note' | 'guide' | 'reference' | 'report' | 'decision' | 'other'> = 
      ['note', 'guide', 'reference', 'report', 'decision', 'other'];

    for (const type of docTypes) {
      it(`2.${docTypes.indexOf(type) + 1} 应该能创建 ${type} 类型文档`, async () => {
        const doc = await factory.createDocument({
          title: `[测试] ${type} 文档`,
          type: type,
        });

        expect(doc.id).toBeDefined();
      });
    }
  });

  // ==================== 文档搜索 ====================

  describe('3. 文档搜索', () => {
    it('3.1 应该能按关键词搜索', async () => {
      const res = await apiGet('/api/documents?search=测试', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });

    it('3.2 应该能按类型筛选', async () => {
      const res = await apiGet('/api/documents?type=note', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });

    it('3.3 应该能按项目筛选', async () => {
      const project = await factory.createProject();
      
      const res = await apiGet(`/api/documents?projectId=${project.id}`, {
        headers: auth.getAuthHeaders(),
      });

      expect(res.ok).toBe(true);
    });
  });

  // ==================== Wiki 功能 ====================

  describe('4. Wiki 功能', () => {
    it('4.1 应该能获取 Wiki 页面列表', async () => {
      const res = await apiGet('/api/wiki', { headers: auth.getAuthHeaders() });
      console.log(`[Wiki 列表] status=${res.status}`);
    });

    it('4.2 应该能获取内置文档', async () => {
      // 获取用户手册（内置文档 ID）
      const res = await apiGet('/api/documents?source=builtin', {
        headers: auth.getAuthHeaders(),
      });

      console.log(`[内置文档] status=${res.status}`);
    });
  });

  // ==================== 文档与项目关联 ====================

  describe('5. 文档与项目关联', () => {
    it('5.1 应该能将文档关联到项目', async () => {
      const project = await factory.createProject();
      
      const doc = await factory.createDocument({
        title: '[测试] 项目文档',
        projectId: project.id,
      });

      expect(doc.projectId).toBe(project.id);
    });
  });

  // ==================== 异常处理 ====================

  describe('6. 异常处理', () => {
    it('6.1 获取不存在的文档应返回 404', async () => {
      const res = await apiGet('/api/documents/non-existent-id', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.status).toBe(404);
    });

    it('6.2 更新不存在的文档应返回 404', async () => {
      const res = await apiPut('/api/documents/non-existent-id', {
        title: '更新',
      }, { headers: auth.getAuthHeaders() });

      expect(res.status).toBe(404);
    });

    it('6.3 删除不存在的文档应返回 404', async () => {
      const res = await apiDelete('/api/documents/non-existent-id', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.status).toBe(404);
    });
  });
});
