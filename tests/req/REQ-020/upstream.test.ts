/**
 * REQ-020: Chat Channel 高并发架构优化 - 上游接口测试
 *
 * 测试目的：确保本次修改不破坏上游调用方依赖的接口
 * 覆盖范围：chat-actions API、parseChatActions、executeActions
 * 
 * 注意：部分测试需要认证，在CI环境中可能需要跳过
 */

import { describe, it, expect } from 'vitest';
import { getBaseUrl } from '@/tests/helpers/api-client';
import { parseChatActions, hasChatActions } from '@/lib/chat-channel/client';

describe('REQ-020: 上游接口稳定性', () => {
  const BASE_URL = getBaseUrl();
  
  // 通用请求头（包含 Origin 用于 CSRF 检查）
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
  });

  describe('/api/chat-actions API', () => {
    it('POST /api/chat-actions 应该返回正确格式（需要认证）', async () => {
      const action = {
        type: 'update_task_status',
        task_id: 'upstream_test_task',
        status: 'in_progress',
      };

      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ actions: [action] }),
      });

      // 未认证返回 401，已认证返回 200
      expect([200, 401]).toContain(res.status);
      
      if (res.status === 200) {
        const data = await res.json();
        
        // 验证返回格式不变
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('summary');
        expect(data.summary).toHaveProperty('total');
        expect(data.summary).toHaveProperty('success');
        expect(data.summary).toHaveProperty('failed');
      }
    });

    it('空 actions 应该返回 400 错误', async () => {
      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ actions: [] }),
      });

      // 未认证时返回 401，已认证时返回 400
      expect([400, 401]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty('error');
      }
    });

    it('未认证请求应该返回 401', async () => {
      // 通过清除 cookie 模拟未认证
      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': BASE_URL,
        },
        body: JSON.stringify({ actions: [{ type: 'get_task', task_id: 'test' }] }),
        // 不携带认证信息
      });

      // 应该返回 401 (认证失败)
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('parseChatActions 解析器', () => {
    it('应该正确解析标准格式 actions', () => {
      const text = `
我已更新任务状态。

{"actions": [
  {"type": "update_task_status", "task_id": "task_001", "status": "in_progress"}
]}

请查看。
      `;

      const result = parseChatActions(text);
      
      expect(result.hasActions).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('update_task_status');
      expect(result.actions[0].task_id).toBe('task_001');
    });

    it('应该正确解析多个 actions', () => {
      const text = `
{"actions": [
  {"type": "update_task_status", "task_id": "task_001", "status": "in_progress"},
  {"type": "add_comment", "task_id": "task_001", "content": "开始处理"}
]}
      `;

      const result = parseChatActions(text);
      
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe('update_task_status');
      expect(result.actions[1].type).toBe('add_comment');
    });

    it('应该返回清理后的内容', () => {
      const text = '正常回复内容\n\n{"actions": [{"type": "get_task", "task_id": "123"}]}\n\n后续内容';
      
      const result = parseChatActions(text);
      
      expect(result.cleanContent).not.toContain('actions');
      expect(result.cleanContent).toContain('正常回复内容');
      expect(result.cleanContent).toContain('后续内容');
    });

    it('无效 JSON 应该返回 parseError', () => {
      const text = '{"actions": [invalid json]}';
      
      const result = parseChatActions(text);
      
      expect(result.hasActions).toBe(false);
      expect(result.parseError).toBeDefined();
    });

    it('hasChatActions 应该快速检测', () => {
      const withActions = '回复 {"actions": []} 结尾';
      const withoutActions = '普通回复';
      
      expect(hasChatActions(withActions)).toBe(true);
      expect(hasChatActions(withoutActions)).toBe(false);
    });
  });

  describe('Action 类型定义', () => {
    it.skip('所有查询类 action 类型应该保持一致', async () => {
      // 跳过：需要认证才能测试
      const queryActions = [
        'get_task',
        'list_my_tasks',
        'get_project',
        'get_document',
        'search_documents',
      ];

      for (const actionType of queryActions) {
        const action = {
          type: actionType,
          task_id: 'test',
          query: 'test',
        };

        const res = await fetch(`${BASE_URL}/api/chat-actions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ actions: [action] }),
        });

        // 应该能正确解析类型，不返回 INVALID_TYPE 错误
        const data = await res.json();
        expect(data.results?.[0]?.errorCode).not.toBe('INVALID_TYPE');
      }
    });

    it.skip('所有写入类 action 类型应该保持一致', async () => {
      // 跳过：需要认证才能测试
      const writeActions = [
        { type: 'update_task_status', task_id: 'test', status: 'in_progress' },
        { type: 'add_comment', task_id: 'test', content: 'test' },
        { type: 'create_document', title: 'test', content: 'test' },
      ];

      for (const action of writeActions) {
        const res = await fetch(`${BASE_URL}/api/chat-actions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ actions: [action] }),
        });

        const data = await res.json();
        // 类型应该被正确识别
        expect(data.results?.[0]?.type).toBe(action.type);
      }
    });
  });

  describe('错误处理', () => {
    it.skip('未知 action 类型应该返回错误', async () => {
      // 跳过：需要认证才能测试
      const action = {
        type: 'unknown_action_type',
        param: 'value',
      };

      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ actions: [action] }),
      });

      expect(res.status).toBe(200); // API 返回 200，但 action 失败
      const data = await res.json();
      expect(data.results?.[0]?.success).toBe(false);
      expect(data.results?.[0]?.errorCode).toBe('INVALID_TYPE');
    });

    it.skip('缺少必填参数应该返回错误', async () => {
      // 跳过：需要认证才能测试
      const action = {
        type: 'update_task_status',
        // 缺少 task_id 和 status
      };

      const res = await fetch(`${BASE_URL}/api/chat-actions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ actions: [action] }),
      });

      const data = await res.json();
      expect(data.results?.[0]?.success).toBe(false);
      expect(data.results?.[0]?.errorCode).toBe('MISSING_REQUIRED');
    });
  });
});
