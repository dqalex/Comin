/**
 * 输入校验工具 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  isValidId,
  isValidUrl,
  REQUEST_LIMITS,
  validateRequestBodySize,
  validateEnum,
  validateEnumWithDefault,
  VALID_TASK_STATUS,
  VALID_PRIORITY,
  VALID_CHAT_ROLE,
  VALID_MESSAGE_STATUS,
  VALID_HISTORY_STATUS,
  VALID_LAST_RUN_STATUS,
  VALID_SCHEDULE_TYPE,
  VALID_TASK_TYPE,
  VALID_DELIVERY_STATUS,
  VALID_MILESTONE_STATUS,
  VALID_DELIVERY_PLATFORM,
  VALID_MEMBER_TYPE,
  VALID_DEPLOY_MODE,
  VALID_CONNECTION_STATUS,
  VALID_CONFIG_SOURCE,
  VALID_EXECUTION_MODE,
  VALID_DOC_SOURCE,
  VALID_EXTERNAL_PLATFORM,
  VALID_SYNC_MODE,
  VALID_DOC_TYPE,
  VALID_OPENCLAW_STATUS,
  VALID_DELIVERABLE_TYPE,
  VALID_ENTITY_TYPE,
} from '@/lib/validators';

// ============================================================================
// isValidId
// ============================================================================

describe('isValidId', () => {
  it('应该接受合法 ID', () => {
    expect(isValidId('abc123')).toBe(true);
    expect(isValidId('task-001')).toBe(true);
    expect(isValidId('member_default')).toBe(true);
    expect(isValidId('A')).toBe(true);
    expect(isValidId('chat-VrihWxkCoM9Q')).toBe(true);
  });

  it('应该拒绝非字符串', () => {
    expect(isValidId(123)).toBe(false);
    expect(isValidId(null)).toBe(false);
    expect(isValidId(undefined)).toBe(false);
    expect(isValidId({})).toBe(false);
    expect(isValidId([])).toBe(false);
    expect(isValidId(true)).toBe(false);
  });

  it('应该拒绝空字符串', () => {
    expect(isValidId('')).toBe(false);
  });

  it('应该拒绝包含特殊字符的字符串', () => {
    expect(isValidId('abc 123')).toBe(false);
    expect(isValidId('abc.123')).toBe(false);
    expect(isValidId('abc/123')).toBe(false);
    expect(isValidId('<script>')).toBe(false);
    expect(isValidId("'; DROP TABLE")); // SQL 注入
  });

  it('应该拒绝超长 ID（>100 字符）', () => {
    const longId = 'a'.repeat(101);
    expect(isValidId(longId)).toBe(false);
  });

  it('应该接受 100 字符的 ID', () => {
    const maxId = 'a'.repeat(100);
    expect(isValidId(maxId)).toBe(true);
  });
});

// ============================================================================
// isValidUrl
// ============================================================================

describe('isValidUrl', () => {
  it('应该接受 HTTP/HTTPS URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('https://api.openai.com/v1/chat')).toBe(true);
  });

  it('应该拒绝非字符串', () => {
    expect(isValidUrl(123)).toBe(false);
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
  });

  it('应该拒绝无效 URL', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false); // 默认只允许 HTTP/HTTPS
  });

  it('应该支持自定义协议白名单', () => {
    expect(isValidUrl('ws://localhost:8789', ['ws:', 'wss:'])).toBe(true);
    expect(isValidUrl('wss://gateway.example.com', ['ws:', 'wss:'])).toBe(true);
    expect(isValidUrl('http://example.com', ['ws:', 'wss:'])).toBe(false);
  });

  it('应该拒绝 javascript: 协议', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  it('应该拒绝 data: 协议', () => {
    expect(isValidUrl('data:text/html,<h1>XSS</h1>')).toBe(false);
  });
});

// ============================================================================
// REQUEST_LIMITS
// ============================================================================

describe('REQUEST_LIMITS', () => {
  it('应该有正确的限制值', () => {
    expect(REQUEST_LIMITS.MAX_BODY_SIZE).toBe(1024 * 1024);
    expect(REQUEST_LIMITS.MAX_STRING_LENGTH).toBe(10 * 1024);
    expect(REQUEST_LIMITS.MAX_ARRAY_LENGTH).toBe(1000);
    expect(REQUEST_LIMITS.MAX_NESTING_DEPTH).toBe(10);
  });
});

// ============================================================================
// validateRequestBodySize
// ============================================================================

describe('validateRequestBodySize', () => {
  it('应该通过小体积请求', () => {
    expect(validateRequestBodySize({ name: 'test' })).toBe(true);
    expect(validateRequestBodySize({})).toBe(true);
    expect(validateRequestBodySize({ list: [1, 2, 3] })).toBe(true);
  });

  it('应该拒绝超大请求体', () => {
    const huge = { data: 'x'.repeat(2 * 1024 * 1024) };
    expect(validateRequestBodySize(huge)).toBe(false);
  });

  it('应该支持自定义大小限制', () => {
    const body = { data: 'x'.repeat(100) };
    expect(validateRequestBodySize(body, 50)).toBe(false);
    expect(validateRequestBodySize(body, 200)).toBe(true);
  });

  it('应该处理循环引用（返回 false）', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(validateRequestBodySize(obj)).toBe(false);
  });

  it('应该处理 null 和 undefined', () => {
    expect(validateRequestBodySize(null)).toBe(true);
    expect(validateRequestBodySize(undefined)).toBe(false); // JSON.stringify(undefined) → undefined
  });
});

// ============================================================================
// 枚举常量完整性检查
// ============================================================================

describe('枚举常量完整性', () => {
  const enumMap: Record<string, readonly string[]> = {
    VALID_TASK_STATUS,
    VALID_PRIORITY,
    VALID_CHAT_ROLE,
    VALID_MESSAGE_STATUS,
    VALID_HISTORY_STATUS,
    VALID_LAST_RUN_STATUS,
    VALID_SCHEDULE_TYPE,
    VALID_TASK_TYPE,
    VALID_DELIVERY_STATUS,
    VALID_MILESTONE_STATUS,
    VALID_DELIVERY_PLATFORM,
    VALID_MEMBER_TYPE,
    VALID_DEPLOY_MODE,
    VALID_CONNECTION_STATUS,
    VALID_CONFIG_SOURCE,
    VALID_EXECUTION_MODE,
    VALID_DOC_SOURCE,
    VALID_EXTERNAL_PLATFORM,
    VALID_SYNC_MODE,
    VALID_DOC_TYPE,
    VALID_OPENCLAW_STATUS,
    VALID_DELIVERABLE_TYPE,
    VALID_ENTITY_TYPE,
  };

  it('所有枚举都应该是非空只读数组', () => {
    for (const [name, values] of Object.entries(enumMap)) {
      expect(Array.isArray(values), `${name} 应该是数组`).toBe(true);
      expect(values.length, `${name} 不应该为空`).toBeGreaterThan(0);
    }
  });

  it('所有枚举值应该是非空字符串', () => {
    for (const [name, values] of Object.entries(enumMap)) {
      for (const v of values) {
        expect(typeof v, `${name} 中的值应该是字符串`).toBe('string');
        expect(v.length, `${name} 中不应有空字符串`).toBeGreaterThan(0);
      }
    }
  });

  it('所有枚举值应该是小写+下划线格式', () => {
    for (const [name, values] of Object.entries(enumMap)) {
      for (const v of values) {
        expect(v, `${name}.${v} 应该是 snake_case 或 kebab-case`).toMatch(/^[a-z0-9_-]+$/);
      }
    }
  });

  it('枚举值不应有重复', () => {
    for (const [name, values] of Object.entries(enumMap)) {
      const unique = new Set(values);
      expect(unique.size, `${name} 不应有重复值`).toBe(values.length);
    }
  });

  // 关键枚举的具体值验证
  it('VALID_TASK_STATUS 应该包含关键状态', () => {
    expect(VALID_TASK_STATUS).toContain('todo');
    expect(VALID_TASK_STATUS).toContain('in_progress');
    expect(VALID_TASK_STATUS).toContain('completed');
  });

  it('VALID_DOC_TYPE 应该包含所有文档类型', () => {
    expect(VALID_DOC_TYPE).toContain('guide');
    expect(VALID_DOC_TYPE).toContain('reference');
    expect(VALID_DOC_TYPE).toContain('note');
    expect(VALID_DOC_TYPE).toContain('report');
    expect(VALID_DOC_TYPE).toContain('decision');
    expect(VALID_DOC_TYPE).toContain('scheduled_task');
    expect(VALID_DOC_TYPE).toContain('task_list');
    expect(VALID_DOC_TYPE).toContain('other');
  });

  it('VALID_MEMBER_TYPE 应该包含 human 和 ai', () => {
    expect(VALID_MEMBER_TYPE).toEqual(['human', 'ai']);
  });
});

// ============================================================================
// validateEnum / validateEnumWithDefault (已有部分测试，此处补充边界)
// ============================================================================

describe('validateEnum 边界测试', () => {
  it('应该对空数组返回 null', () => {
    expect(validateEnum('test', [] as unknown as readonly string[])).toBeNull();
  });

  it('应该区分大小写', () => {
    expect(validateEnum('TODO', VALID_TASK_STATUS)).toBeNull();
    expect(validateEnum('Todo', VALID_TASK_STATUS)).toBeNull();
  });

  it('应该处理带空格的值', () => {
    expect(validateEnum(' todo ', VALID_TASK_STATUS)).toBeNull();
    expect(validateEnum('todo ', VALID_TASK_STATUS)).toBeNull();
  });
});

describe('validateEnumWithDefault 边界测试', () => {
  it('应该处理空字符串', () => {
    expect(validateEnumWithDefault('', VALID_TASK_STATUS, 'todo')).toBe('todo');
  });

  it('应该处理 boolean 类型', () => {
    expect(validateEnumWithDefault(true, VALID_TASK_STATUS, 'todo')).toBe('todo');
    expect(validateEnumWithDefault(false, VALID_TASK_STATUS, 'todo')).toBe('todo');
  });
});
