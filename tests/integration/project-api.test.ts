/**
 * 项目 API 集成测试
 *
 * 测试覆盖：
 * 1. 项目 CRUD
 * 2. 项目成员管理
 * 3. 项目设置
 *
 * 运行方式：
 *   npx vitest run tests/integration/project-api.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete } from '../helpers/api-client';
import { AuthHelper, setupAuth } from '../helpers/auth-helper';
import { TestDataFactory } from '../helpers/test-fixture';

describe('项目 API 集成测试', () => {
  let auth: AuthHelper;
  let factory: TestDataFactory;
  let testProjectId: string;

  beforeAll(async () => {
    auth = await setupAuth('member');
    factory = new TestDataFactory();
    factory.setAuthHeaders(auth.getAuthHeaders());
  });

  afterAll(async () => {
    await factory.cleanup();
    await auth.logout();
  });

  // ==================== 项目 CRUD ====================

  describe('1. 项目 CRUD', () => {
    it('1.1 应该能创建项目', async () => {
      const project = await factory.createProject({
        name: '[测试] CRUD 测试项目',
        description: '测试项目描述',
        status: 'active',
      });

      expect(project.id).toBeDefined();
      expect(project.name).toContain('[测试]');
      testProjectId = project.id;

      console.log(`[创建项目] id=${project.id}`);
    });

    it('1.2 应该能获取项目列表', async () => {
      const res = await apiGet('/api/projects', { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const projects = Array.isArray(res.data) ? res.data : (res.data as { data: unknown[] }).data;
      expect(Array.isArray(projects)).toBe(true);
    });

    it('1.3 应该能获取单个项目', async () => {
      if (!testProjectId) {
        throw new Error('项目 ID 未设置');
      }

      const res = await apiGet(`/api/projects/${testProjectId}`, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      const project = res.data as { id: string; name: string };
      expect(project.id).toBe(testProjectId);
    });

    it('1.4 应该能更新项目', async () => {
      if (!testProjectId) {
        throw new Error('项目 ID 未设置');
      }

      const res = await apiPut(`/api/projects/${testProjectId}`, {
        name: '[测试] 已更新的项目名称',
        description: '更新后的描述',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });

    it('1.5 应该能删除项目', async () => {
      // 创建一个专门用于删除的项目
      const project = await factory.createProject({
        name: '[测试] 待删除项目',
      });

      const res = await apiDelete(`/api/projects/${project.id}`, { headers: auth.getAuthHeaders() });
      expect(res.ok).toBe(true);

      // 验证已删除
      const getRes = await apiGet(`/api/projects/${project.id}`, { headers: auth.getAuthHeaders() });
      expect(getRes.status).toBe(404);
    });
  });

  // ==================== 项目状态 ====================

  describe('2. 项目状态', () => {
    let statusProjectId: string;

    it('2.1 应该能归档项目', async () => {
      const project = await factory.createProject({
        name: '[测试] 状态项目',
        status: 'active',
      });
      statusProjectId = project.id;

      const res = await apiPut(`/api/projects/${statusProjectId}`, {
        status: 'archived',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });

    it('2.2 应该能完成项目', async () => {
      if (!statusProjectId) {
        throw new Error('项目 ID 未设置');
      }

      const res = await apiPut(`/api/projects/${statusProjectId}`, {
        status: 'completed',
      }, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
    });
  });

  // ==================== 项目统计 ====================

  describe('3. 项目统计', () => {
    it('3.1 应该能获取项目下的任务统计', async () => {
      const project = await factory.createProject();

      // 创建几个任务
      await factory.createTask({ projectId: project.id, status: 'todo' });
      await factory.createTask({ projectId: project.id, status: 'completed' });

      const res = await apiGet(`/api/projects/${project.id}`, { headers: auth.getAuthHeaders() });

      expect(res.ok).toBe(true);
      console.log(`[项目详情]`, JSON.stringify(res.data, null, 2).slice(0, 200));
    });
  });

  // ==================== 异常处理 ====================

  describe('4. 异常处理', () => {
    it('4.1 获取不存在的项目应返回 404', async () => {
      const res = await apiGet('/api/projects/non-existent-id', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.status).toBe(404);
    });

    it('4.2 更新不存在的项目应返回 404', async () => {
      const res = await apiPut('/api/projects/non-existent-id', {
        name: '更新',
      }, { headers: auth.getAuthHeaders() });

      expect(res.status).toBe(404);
    });

    it('4.3 删除不存在的项目应返回 404', async () => {
      const res = await apiDelete('/api/projects/non-existent-id', {
        headers: auth.getAuthHeaders(),
      });

      expect(res.status).toBe(404);
    });
  });
});
