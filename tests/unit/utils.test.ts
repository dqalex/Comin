/**
 * 数据脱敏 + 枚举校验 + 工具策略 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import { sanitizeObject, sanitizeMember, hasApiToken } from '@/lib/sanitize';
import { validateEnum, validateEnumWithDefault, VALID_TASK_STATUS, VALID_PRIORITY } from '@/lib/validators';
import { normalizeToolName, isAllowedByPolicy, resolveToolProfilePolicy } from '@/lib/tool-policy';

// ============================================================================
// 数据脱敏
// ============================================================================

describe('Sanitize', () => {
  describe('sanitizeObject', () => {
    it('应该屏蔽敏感字段', () => {
      const obj = { name: 'test', openclawApiToken: 'secret-token-123', email: 'a@b.com' };
      const result = sanitizeObject(obj);
      expect(result.openclawApiToken).toBe('••••••••');
      expect(result.name).toBe('test');
      expect(result.email).toBe('a@b.com');
    });

    it('应该添加 has* 标志位', () => {
      const obj = { apiKey: 'key123' };
      const result = sanitizeObject(obj) as Record<string, unknown>;
      expect(result.apiKey).toBe('••••••••');
      expect(result.hasApiKey).toBe(true);
    });

    it('应该保留空敏感字段', () => {
      const obj = { openclawApiToken: '', name: 'test' };
      const result = sanitizeObject(obj);
      // 空字符串是 falsy，不应被屏蔽
      expect(result.openclawApiToken).toBe('');
    });

    it('应该返回新对象（不可变）', () => {
      const obj = { password: 'secret' };
      const result = sanitizeObject(obj);
      expect(result).not.toBe(obj);
      expect(obj.password).toBe('secret'); // 原对象不变
    });
  });

  describe('sanitizeMember', () => {
    it('应该脱敏成员 Token', () => {
      const member = { id: '1', name: 'test', openclawApiToken: 'secret' };
      const result = sanitizeMember(member);
      expect(result.openclawApiToken).toBe('••••••••');
      expect(result.hasApiToken).toBe(true);
    });

    it('Token 为空时应该返回 null 和 false', () => {
      const member = { id: '1', name: 'test', openclawApiToken: null };
      const result = sanitizeMember(member);
      expect(result.openclawApiToken).toBeNull();
      expect(result.hasApiToken).toBe(false);
    });
  });

  describe('hasApiToken', () => {
    it('有 Token 应该返回 true', () => {
      expect(hasApiToken({ openclawApiToken: 'abc' })).toBe(true);
    });

    it('无 Token 应该返回 false', () => {
      expect(hasApiToken({ openclawApiToken: '' })).toBe(false);
      expect(hasApiToken({ openclawApiToken: null })).toBe(false);
      expect(hasApiToken({})).toBe(false);
    });
  });
});

// ============================================================================
// 枚举校验
// ============================================================================

describe('Validators', () => {
  describe('validateEnum', () => {
    it('应该通过有效枚举值', () => {
      expect(validateEnum('todo', VALID_TASK_STATUS)).toBe('todo');
      expect(validateEnum('in_progress', VALID_TASK_STATUS)).toBe('in_progress');
      expect(validateEnum('high', VALID_PRIORITY)).toBe('high');
    });

    it('应该拒绝无效枚举值', () => {
      expect(validateEnum('invalid', VALID_TASK_STATUS)).toBeNull();
      expect(validateEnum('DONE', VALID_TASK_STATUS)).toBeNull();
    });

    it('应该拒绝非字符串', () => {
      expect(validateEnum(123, VALID_TASK_STATUS)).toBeNull();
      expect(validateEnum(null, VALID_TASK_STATUS)).toBeNull();
      expect(validateEnum(undefined, VALID_TASK_STATUS)).toBeNull();
    });
  });

  describe('validateEnumWithDefault', () => {
    it('有效值应该返回原值', () => {
      expect(validateEnumWithDefault('todo', VALID_TASK_STATUS, 'in_progress')).toBe('todo');
    });

    it('无效值应该返回默认值', () => {
      expect(validateEnumWithDefault('invalid', VALID_TASK_STATUS, 'todo')).toBe('todo');
      expect(validateEnumWithDefault(null, VALID_TASK_STATUS, 'todo')).toBe('todo');
    });
  });
});

// ============================================================================
// 工具策略
// ============================================================================

describe('Tool Policy', () => {
  describe('normalizeToolName', () => {
    it('应该转换别名', () => {
      expect(normalizeToolName('bash')).toBe('exec');
      expect(normalizeToolName('apply-patch')).toBe('apply_patch');
    });

    it('应该转为小写并去空格', () => {
      expect(normalizeToolName('  READ  ')).toBe('read');
      expect(normalizeToolName('Write')).toBe('write');
    });

    it('未知名称应该原样返回（小写）', () => {
      expect(normalizeToolName('custom_tool')).toBe('custom_tool');
    });
  });

  describe('isAllowedByPolicy', () => {
    it('无策略应该允许所有工具', () => {
      expect(isAllowedByPolicy('read')).toBe(true);
      expect(isAllowedByPolicy('exec')).toBe(true);
    });

    it('deny 列表应该阻止工具', () => {
      expect(isAllowedByPolicy('exec', { deny: ['exec'] })).toBe(false);
      expect(isAllowedByPolicy('read', { deny: ['exec'] })).toBe(true);
    });

    it('allow 列表应该只允许指定工具', () => {
      expect(isAllowedByPolicy('read', { allow: ['read', 'write'] })).toBe(true);
      expect(isAllowedByPolicy('exec', { allow: ['read', 'write'] })).toBe(false);
    });

    it('deny 优先于 allow', () => {
      expect(isAllowedByPolicy('read', { allow: ['read'], deny: ['read'] })).toBe(false);
    });

    it('应该展开工具组', () => {
      expect(isAllowedByPolicy('read', { allow: ['group:fs'] })).toBe(true);
      expect(isAllowedByPolicy('write', { allow: ['group:fs'] })).toBe(true);
      expect(isAllowedByPolicy('exec', { allow: ['group:fs'] })).toBe(false);
    });

    it('空 allow 列表应该允许所有', () => {
      expect(isAllowedByPolicy('exec', { allow: [] })).toBe(true);
    });
  });

  describe('resolveToolProfilePolicy', () => {
    it('应该返回 minimal profile 策略', () => {
      const policy = resolveToolProfilePolicy('minimal');
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('session_status');
    });

    it('应该返回 coding profile 策略', () => {
      const policy = resolveToolProfilePolicy('coding');
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('group:fs');
      expect(policy!.allow).toContain('group:runtime');
    });

    it('full profile 应该返回 undefined（无限制）', () => {
      expect(resolveToolProfilePolicy('full')).toBeUndefined();
    });

    it('未知 profile 应该返回 undefined', () => {
      expect(resolveToolProfilePolicy('unknown')).toBeUndefined();
    });
  });
});
