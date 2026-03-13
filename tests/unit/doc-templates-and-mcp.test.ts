/**
 * 文档模板 + MCP 工具定义 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import { DOC_TEMPLATES } from '@/lib/doc-templates';
import { TEAMCLAW_TOOLS } from '@/core/mcp/definitions';
import { VALID_DOC_TYPE } from '@/lib/validators';
import type { ActionInstruction, ExecutionResult, PendingQuestion } from '@/core/mcp/types';

// ============================================================================
// 文档模板
// ============================================================================

describe('DOC_TEMPLATES', () => {
  it('应该导出一个对象', () => {
    expect(typeof DOC_TEMPLATES).toBe('object');
    expect(DOC_TEMPLATES).not.toBeNull();
  });

  it('应该为已知文档类型提供模板', () => {
    // 必须有模板的类型
    const typesWithTemplate = ['report', 'decision', 'scheduled_task', 'task_list'];
    for (const type of typesWithTemplate) {
      expect(DOC_TEMPLATES[type], `${type} 应该有模板`).toBeDefined();
      expect(DOC_TEMPLATES[type].length, `${type} 模板不应为空`).toBeGreaterThan(0);
    }
  });

  it('note 和 other 应该是空模板', () => {
    expect(DOC_TEMPLATES['note']).toBe('');
    expect(DOC_TEMPLATES['other']).toBe('');
  });

  it('report 模板应该包含关键章节', () => {
    const template = DOC_TEMPLATES['report'];
    expect(template).toContain('## 背景');
    expect(template).toContain('## 关键发现');
    expect(template).toContain('## 数据分析');
    expect(template).toContain('## 结论与建议');
  });

  it('decision 模板应该包含方案对比结构', () => {
    const template = DOC_TEMPLATES['decision'];
    expect(template).toContain('## 决策主题');
    expect(template).toContain('### 方案 A');
    expect(template).toContain('### 方案 B');
    expect(template).toContain('## 决策结果');
  });

  it('task_list 模板应该包含 frontmatter', () => {
    const template = DOC_TEMPLATES['task_list'];
    expect(template).toContain('---');
    expect(template).toContain('type: teamclaw:tasks');
  });

  it('scheduled_task 模板应该包含调度配置', () => {
    const template = DOC_TEMPLATES['scheduled_task'];
    expect(template).toContain('## 调度配置');
    expect(template).toContain('## 执行步骤');
    expect(template).toContain('## 异常处理');
  });
});

// ============================================================================
// MCP 工具定义
// ============================================================================

describe('TEAMCLAW_TOOLS', () => {
  it('应该导出一个非空对象', () => {
    expect(typeof TEAMCLAW_TOOLS).toBe('object');
    expect(Object.keys(TEAMCLAW_TOOLS).length).toBeGreaterThan(0);
  });

  it('每个工具应该有 name、description、parameters', () => {
    for (const [key, tool] of Object.entries(TEAMCLAW_TOOLS)) {
      expect(tool.name, `${key} 应该有 name`).toBeDefined();
      expect(tool.description, `${key} 应该有 description`).toBeDefined();
      expect(tool.parameters, `${key} 应该有 parameters`).toBeDefined();
    }
  });

  it('工具 name 应该与对象键一致', () => {
    for (const [key, tool] of Object.entries(TEAMCLAW_TOOLS)) {
      expect(tool.name, `${key} 的 name 与键不一致`).toBe(key);
    }
  });

  it('parameters 应该是合法的 JSON Schema 结构', () => {
    for (const [key, tool] of Object.entries(TEAMCLAW_TOOLS)) {
      expect(tool.parameters.type, `${key}.parameters.type 应该是 object`).toBe('object');
      expect(tool.parameters.properties, `${key}.parameters.properties 应该存在`).toBeDefined();
      expect(typeof tool.parameters.properties, `${key}.parameters.properties 应该是对象`).toBe('object');
    }
  });

  it('required 字段中的属性必须在 properties 中定义', () => {
    for (const [key, tool] of Object.entries(TEAMCLAW_TOOLS)) {
      const params = tool.parameters as { required?: string[]; properties: Record<string, unknown> };
      const required = params.required;
      if (required) {
        const propertyNames = Object.keys(params.properties);
        for (const req of required) {
          expect(propertyNames, `${key} 的 required 字段 "${req}" 在 properties 中未定义`).toContain(req);
        }
      }
    }
  });

  it('description 不应为空', () => {
    for (const [key, tool] of Object.entries(TEAMCLAW_TOOLS)) {
      expect(tool.description.length, `${key} 的 description 不应为空`).toBeGreaterThan(0);
    }
  });

  // 关键工具存在性验证
  it('应该包含核心任务工具', () => {
    expect(TEAMCLAW_TOOLS).toHaveProperty('get_task');
    expect(TEAMCLAW_TOOLS).toHaveProperty('list_my_tasks');
    expect(TEAMCLAW_TOOLS).toHaveProperty('update_task_status');
    expect(TEAMCLAW_TOOLS).toHaveProperty('add_task_comment');
  });

  it('应该包含文档工具', () => {
    expect(TEAMCLAW_TOOLS).toHaveProperty('create_document');
    expect(TEAMCLAW_TOOLS).toHaveProperty('update_document');
  });

  it('应该包含成员注册工具', () => {
    expect(TEAMCLAW_TOOLS).toHaveProperty('register_member');
  });
});

// ============================================================================
// MCP 类型结构验证
// ============================================================================

describe('MCP Types', () => {
  it('ActionInstruction 应该有正确的类型联合', () => {
    // 编译时类型检查 + 运行时验证
    const validTypes: ActionInstruction['type'][] = [
      'update_task', 'add_comment', 'create_check_item', 'complete_check_item',
      'create_document', 'update_document', 'request_info', 'ask_user',
      'update_status', 'set_queue', 'set_do_not_disturb',
      'create_schedule', 'list_schedules', 'delete_schedule', 'update_schedule',
      'deliver_document', 'review_delivery', 'list_my_deliveries', 'get_delivery',
      'register_member', 'create_milestone', 'list_milestones', 'update_milestone', 'delete_milestone',
    ];

    // 确保每个类型都能创建合法的 ActionInstruction
    for (const type of validTypes) {
      const action: ActionInstruction = { type };
      expect(action.type).toBe(type);
    }
  });

  it('ExecutionResult 应该包含必要字段', () => {
    const result: ExecutionResult = {
      actionType: 'update_task',
      success: true,
      message: '任务已更新',
      timestamp: new Date(),
    };
    expect(result.actionType).toBe('update_task');
    expect(result.success).toBe(true);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('PendingQuestion 应该包含必要字段', () => {
    const question: PendingQuestion = {
      id: 'q-1',
      question: '确认吗？',
      options: ['是', '否'],
      urgent: false,
      askedAt: new Date(),
    };
    expect(question.id).toBe('q-1');
    expect(question.options).toHaveLength(2);
  });
});
