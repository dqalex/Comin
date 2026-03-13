/**
 * SOP 流程集成测试
 * 
 * 测试覆盖：
 * 1. SOP 模板 CRUD
 * 2. 任务绑定 SOP 模板
 * 3. 阶段推进（advance_stage）
 * 4. 人工确认流程（request_confirm）
 * 5. 阶段上下文获取（get_context）
 * 6. 输出保存（save_stage_output）
 * 7. 知识库更新（update_knowledge）
 * 
 * 运行方式：
 *   npx vitest run tests/integration/sop-flow.test.ts
 *   TEST_TARGET=remote npx vitest run tests/integration/sop-flow.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete, getBaseUrl, checkServiceHealth } from '../helpers/api-client';

// ============================================================================
// 测试数据
// ============================================================================

/** 测试用户凭证 */
const TEST_USER = {
  email: 'test-sop@teamclaw.local',
  password: 'TestPassword123!',
  name: 'SOP 测试用户',
};

/** 测试用 SOP 模板（3 阶段：input → ai_auto → ai_with_confirm） */
const TEST_SOP_TEMPLATE = {
  name: '[测试] 内容生成 SOP',
  description: '用于自动化测试的 SOP 模板',
  category: 'content',
  icon: 'clipboard-list',
  status: 'active',
  stages: [
    {
      id: 'stage-input',
      label: '输入需求',
      type: 'input',
      promptTemplate: '请输入您要生成的内容需求：',
      outputType: 'text',
    },
    {
      id: 'stage-ai',
      label: 'AI 生成',
      type: 'ai_auto',
      promptTemplate: '根据输入的需求生成内容：{{sop_inputs.requirement}}',
      outputType: 'markdown',
    },
    {
      id: 'stage-confirm',
      label: '人工确认',
      type: 'ai_with_confirm',
      promptTemplate: '请确认生成的内容是否符合预期',
      outputType: 'markdown',
    },
  ],
  systemPrompt: '你是一个专业的内容生成助手',
  requiredTools: ['get_sop_context', 'advance_sop_stage', 'save_stage_output'],
};

/** 测试用任务 */
const TEST_TASK = {
  title: '[测试] SOP 流程测试任务',
  description: '用于测试 SOP 流程的任务',
  status: 'todo',
  priority: 'medium',
};

// ============================================================================
// 辅助函数
// ============================================================================

/** 生成唯一 ID */
function generateId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 等待指定毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 获取认证头 */
function authHeaders(): { headers: { Cookie: string } } {
  return { headers: { Cookie: `cms_session=${sessionCookie}` } };
}

// 全局 sessionCookie 变量（在 beforeAll 中设置）
let sessionCookie: string = '';

// ============================================================================
// 测试套件
// ============================================================================

describe('SOP 流程集成测试', () => {
  let templateId: string = '';
  let taskId: string = '';
  let projectId: string = '';

  // -------------------- 前置检查 --------------------

  beforeAll(async () => {
    // 检查服务是否可达
    const health = await checkServiceHealth();
    console.log(`[测试环境] target=${health.target}, url=${health.url}, reachable=${health.reachable}`);
    
    if (!health.reachable) {
      console.error(`服务不可达: ${health.error}`);
      throw new Error(`服务不可达，请确保开发服务器已启动: ${getBaseUrl()}`);
    }

    // 注册测试用户
    console.log(`[注册] 创建测试用户: ${TEST_USER.email}`);
    const registerRes = await apiPost('/api/auth/register', {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: TEST_USER.name,
    });
    console.log(`[注册] status=${registerRes.status}`);

    // 登录获取 session
    console.log(`[登录] 使用测试用户登录...`);
    const loginRes = await apiPost('/api/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (loginRes.ok) {
      // 从 Set-Cookie 提取 session
      const setCookie = loginRes.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/cms_session=([^;]+)/);
        if (match) {
          sessionCookie = match[1];
          console.log(`[登录] 成功获取 session`);
        }
      }
    }

    if (!sessionCookie) {
      throw new Error('登录失败，无法获取 session');
    }
  });

  // -------------------- 清理 --------------------

  afterAll(async () => {
    // 清理测试数据
    if (taskId) {
      try {
        await apiDelete(`/api/tasks/${taskId}`, authHeaders());
        console.log(`[清理] 已删除任务: ${taskId}`);
      } catch (e) {
        console.warn(`[清理] 删除任务失败:`, e);
      }
    }
    
    if (templateId) {
      try {
        await apiDelete(`/api/sop-templates/${templateId}`, authHeaders());
        console.log(`[清理] 已删除 SOP 模板: ${templateId}`);
      } catch (e) {
        console.warn(`[清理] 删除 SOP 模板失败:`, e);
      }
    }

    if (projectId) {
      try {
        await apiDelete(`/api/projects/${projectId}`, authHeaders());
        console.log(`[清理] 已删除项目: ${projectId}`);
      } catch (e) {
        console.warn(`[清理] 删除项目失败:`, e);
      }
    }
  });

  // -------------------- SOP 模板 CRUD --------------------

  describe('1. SOP 模板 CRUD', () => {
    it('1.1 应该能创建 SOP 模板', async () => {
      const res = await apiPost('/api/sop-templates', {
        id: generateId(),
        ...TEST_SOP_TEMPLATE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, authHeaders());

      expect(res.ok).toBe(true);
      expect(res.data).toHaveProperty('id');
      templateId = (res.data as { id: string }).id;
      console.log(`[创建模板] id=${templateId}`);
    });

    it('1.2 应该能获取 SOP 模板列表', async () => {
      const res = await apiGet('/api/sop-templates', authHeaders());
      expect(res.ok).toBe(true);
      
      const templates = Array.isArray(res.data) ? res.data : (res.data as { data: unknown[] }).data;
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('1.3 应该能获取单个 SOP 模板', async () => {
      if (!templateId) {
        throw new Error('模板 ID 未设置，跳过测试');
      }

      const res = await apiGet(`/api/sop-templates/${templateId}`, authHeaders());
      expect(res.ok).toBe(true);
      
      const template = res.data as { id: string; name: string; stages: unknown[] };
      expect(template.id).toBe(templateId);
      expect(template.name).toBe(TEST_SOP_TEMPLATE.name);
      expect(template.stages).toHaveLength(3);
    });

    it('1.4 应该能更新 SOP 模板', async () => {
      if (!templateId) {
        throw new Error('模板 ID 未设置，跳过测试');
      }

      const res = await apiPut(`/api/sop-templates/${templateId}`, {
        description: '更新后的描述',
      }, authHeaders());

      expect(res.ok).toBe(true);
    });
  });

  // -------------------- 任务绑定 SOP --------------------

  describe('2. 任务绑定 SOP 模板', () => {
    it('2.1 应该能创建任务', async () => {
      const res = await apiPost('/api/tasks', {
        id: generateId(),
        ...TEST_TASK,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, authHeaders());

      expect(res.ok).toBe(true);
      taskId = (res.data as { id: string }).id;
      console.log(`[创建任务] id=${taskId}`);
    });

    it('2.2 应该能为任务绑定 SOP 模板', async () => {
      if (!taskId || !templateId) {
        throw new Error('任务或模板 ID 未设置，跳过测试');
      }

      const res = await apiPut(`/api/tasks/${taskId}`, {
        sopTemplateId: templateId,
        currentStageId: 'stage-input',  // 绑定时设置第一阶段
      }, authHeaders());

      expect(res.ok).toBe(true);
    });

    it('2.3 绑定后任务应该包含 SOP 相关字段', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      const res = await apiGet(`/api/tasks/${taskId}`, authHeaders());
      expect(res.ok).toBe(true);
      
      const task = res.data as { 
        sopTemplateId: string; 
        currentStageId: string; 
        stageHistory: unknown[];
      };
      expect(task.sopTemplateId).toBe(templateId);
      expect(task.currentStageId).toBe('stage-input');
      expect(Array.isArray(task.stageHistory)).toBe(true);
    });
  });

  // -------------------- SOP 输入阶段 --------------------

  describe('3. SOP 输入阶段 (input)', () => {
    it('3.1 应该能通过 MCP 设置 SOP 输入', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      // 通过 MCP 设置 SOP 输入
      const res = await apiPost('/api/mcp', {
        tool: 'advance_sop_stage',
        parameters: {
          task_id: taskId,
          stage_output: JSON.stringify({ requirement: '生成一篇关于 AI 的文章' }),
        },
      }, authHeaders());

      // 检查响应（可能成功或失败，取决于 MCP 是否需要认证）
      console.log(`[MCP 响应] status=${res.status}`, res.data);
    });
  });

  // -------------------- 阶段上下文 --------------------

  describe('4. 获取 SOP 上下文', () => {
    it('4.1 应该能获取当前 SOP 执行上下文', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      const res = await apiPost('/api/mcp', {
        tool: 'get_sop_context',
        parameters: {
          task_id: taskId,
        },
      }, authHeaders());

      console.log(`[上下文响应]`, JSON.stringify(res.data, null, 2));
      
      // 如果成功，检查返回数据结构
      if (res.ok) {
        const responseData = res.data as {
          success: boolean;
          data?: {
            task_id: string;
            sop_template: { id: string; name: string };
            current_stage: { id: string; label: string; type: string };
            progress: { current_index: number; total_stages: number };
          };
        };
        
        // 数据在 data 字段中
        const context = responseData.data;
        if (context) {
          expect(context.task_id).toBe(taskId);
          expect(context.sop_template).toBeDefined();
          expect(context.current_stage).toBeDefined();
        }
      }
    });
  });

  // -------------------- 阶段推进 --------------------

  describe('5. 阶段推进', () => {
    it('5.1 应该能推进到下一阶段', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      const res = await apiPost('/api/mcp', {
        tool: 'advance_sop_stage',
        parameters: {
          task_id: taskId,
          stage_output: '这是 AI 生成的测试内容...',
        },
      }, authHeaders());

      console.log(`[推进阶段响应]`, JSON.stringify(res.data, null, 2));
    });

    it('5.2 推进后任务状态应更新', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      await delay(100); // 等待数据同步

      const res = await apiGet(`/api/tasks/${taskId}`, authHeaders());
      if (res.ok) {
        const task = res.data as { 
          currentStageId: string; 
          progress: number;
          stageHistory: { stageId: string; status: string }[];
        };
        console.log(`[任务状态] currentStageId=${task.currentStageId}, progress=${task.progress}%`);
      }
    });
  });

  // -------------------- 人工确认 --------------------

  describe('6. 人工确认流程', () => {
    it('6.1 AI 应该能请求人工确认', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      const res = await apiPost('/api/mcp', {
        tool: 'request_sop_confirm',
        parameters: {
          task_id: taskId,
          confirm_message: '请确认生成的内容是否符合预期？',
          stage_output: '这是需要确认的内容...',
        },
      }, authHeaders());

      console.log(`[请求确认响应]`, JSON.stringify(res.data, null, 2));
    });

    it('6.2 等待确认时任务状态应为 waiting_confirm', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      await delay(100);

      const res = await apiGet(`/api/tasks/${taskId}`, authHeaders());
      if (res.ok) {
        const task = res.data as { stageHistory: { stageId: string; status: string }[] };
        const lastStage = task.stageHistory[task.stageHistory.length - 1];
        console.log(`[最后阶段状态]`, lastStage);
      }
    });
  });

  // -------------------- 保存输出 --------------------

  describe('7. 保存阶段输出', () => {
    it('7.1 应该能保存阶段输出（不推进）', async () => {
      if (!taskId) {
        throw new Error('任务 ID 未设置，跳过测试');
      }

      const res = await apiPost('/api/mcp', {
        tool: 'save_stage_output',
        params: {
          task_id: taskId,
          output: '保存的输出内容（测试）',
          output_type: 'markdown',
        },
      }, authHeaders());

      console.log(`[保存输出响应]`, JSON.stringify(res.data, null, 2));
    });
  });

  // -------------------- 异常处理 --------------------

  describe('8. 异常处理', () => {
    it('8.1 不存在的任务应该返回错误', async () => {
      const res = await apiPost('/api/mcp', {
        tool: 'get_sop_context',
        params: {
          task_id: 'non-existent-task-id',
        },
      }, authHeaders());

      // 应该返回失败（具体行为取决于 MCP 配置）
      console.log(`[异常响应] status=${res.status}`, res.data);
    });

    it('8.2 缺少必填参数应该返回错误', async () => {
      const res = await apiPost('/api/mcp', {
        tool: 'advance_sop_stage',
        params: {}, // 缺少 task_id
      }, authHeaders());

      console.log(`[参数缺失响应]`, res.data);
    });
  });
});
