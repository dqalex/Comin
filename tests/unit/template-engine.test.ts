/**
 * 模板引擎 renderTemplate - 单元测试
 */

import { describe, it, expect } from 'vitest';
import { renderTemplate } from '@/lib/template-engine';

describe('Template Engine - renderTemplate', () => {
  describe('简单变量替换', () => {
    it('应该替换 {{variable}}', () => {
      const result = renderTemplate('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('应该替换多个变量', () => {
      const result = renderTemplate('{{greeting}} {{name}}', { greeting: 'Hi', name: 'Alice' });
      expect(result).toBe('Hi Alice');
    });

    it('未匹配的变量应该替换为空字符串', () => {
      const result = renderTemplate('Hello {{unknown}}', {});
      expect(result).toBe('Hello ');
    });

    it('应该处理空上下文', () => {
      const result = renderTemplate('Hello World', {});
      expect(result).toBe('Hello World');
    });
  });

  describe('条件块', () => {
    it('truthy 值应该渲染条件块', () => {
      const result = renderTemplate('{{#show}}visible{{/show}}', { show: true });
      expect(result).toBe('visible');
    });

    it('falsy 值应该不渲染条件块', () => {
      const result = renderTemplate('{{#show}}hidden{{/show}}', { show: false });
      expect(result).toBe('');
    });

    it('空数组应该不渲染条件块', () => {
      const result = renderTemplate('{{#items}}has items{{/items}}', { items: [] });
      expect(result).toBe('');
    });

    it('null/undefined 应该不渲染条件块', () => {
      const result = renderTemplate('{{#missing}}hidden{{/missing}}', {});
      expect(result).toBe('');
    });
  });

  describe('循环块', () => {
    it('应该循环渲染数组', () => {
      const result = renderTemplate(
        '{{#items}}- {{name}}\n{{/items}}',
        { items: [{ name: 'A' }, { name: 'B' }] }
      );
      expect(result).toContain('- A');
      expect(result).toContain('- B');
    });

    it('应该支持 {{.}} 简单值数组', () => {
      const result = renderTemplate(
        '{{#tags}}[{{.}}]{{/tags}}',
        { tags: ['js', 'ts'] }
      );
      expect(result).toContain('[js]');
      expect(result).toContain('[ts]');
    });
  });

  describe('嵌套属性', () => {
    it('应该支持 {{a.b}} 嵌套访问', () => {
      const result = renderTemplate(
        '{{user.name}}',
        { user: { name: 'Alice' } }
      );
      expect(result).toBe('Alice');
    });
  });

  describe('frontmatter 处理', () => {
    it('应该移除 frontmatter', () => {
      const template = `---
title: Test
---
Hello {{name}}`;
      const result = renderTemplate(template, { name: 'World' });
      expect(result).not.toContain('---');
      expect(result).not.toContain('title: Test');
      expect(result).toContain('Hello World');
    });
  });

  describe('边界条件', () => {
    it('应该处理空模板', () => {
      const result = renderTemplate('', {});
      expect(result).toBe('');
    });

    it('应该处理无变量的模板', () => {
      const result = renderTemplate('plain text', { key: 'value' });
      expect(result).toBe('plain text');
    });
  });
});
