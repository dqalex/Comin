/**
 * 安全工具函数 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  isPrivateIp,
  isLoopbackIp,
  isAllowedLocalUrl,
  sanitizeString,
  isValidId,
  isValidUrl,
  validateRequestBodySize,
  REQUEST_LIMITS,
} from '@/lib/security';

describe('Security Utils', () => {
  describe('escapeHtml', () => {
    it('应该转义所有危险 HTML 字符', () => {
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml("'")).toBe('&#39;');
      expect(escapeHtml('/')).toBe('&#x2F;');
      expect(escapeHtml('`')).toBe('&#x60;');
      expect(escapeHtml('=')).toBe('&#x3D;');
    });

    it('应该转义 XSS 攻击字符串', () => {
      const xss = '<script>alert("xss")</script>';
      const result = escapeHtml(xss);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('应该保留安全字符', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
      expect(escapeHtml('123')).toBe('123');
      expect(escapeHtml('中文文本')).toBe('中文文本');
    });

    it('应该处理空字符串', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('isPrivateIp', () => {
    it('应该识别 10.x.x.x 段', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('应该识别 172.16-31.x.x 段', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
      expect(isPrivateIp('172.15.0.1')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('应该识别 192.168.x.x 段', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.1.100')).toBe(true);
    });

    it('应该识别 IPv6 私有地址', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd00::1')).toBe(true);
      expect(isPrivateIp('fe80::1')).toBe(true);
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('应该拒绝公网 IP', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
    });
  });

  describe('isLoopbackIp', () => {
    it('应该识别 IPv4 回环', () => {
      expect(isLoopbackIp('127.0.0.1')).toBe(true);
      expect(isLoopbackIp('127.0.0.2')).toBe(true);
      expect(isLoopbackIp('127.255.255.255')).toBe(true);
    });

    it('应该识别 IPv6 回环', () => {
      expect(isLoopbackIp('::1')).toBe(true);
      expect(isLoopbackIp('[::1]')).toBe(true);
    });

    it('应该拒绝非回环地址', () => {
      expect(isLoopbackIp('192.168.1.1')).toBe(false);
      expect(isLoopbackIp('10.0.0.1')).toBe(false);
    });
  });

  describe('isAllowedLocalUrl', () => {
    it('应该允许 localhost', () => {
      expect(isAllowedLocalUrl('http://localhost:3000').allowed).toBe(true);
      expect(isAllowedLocalUrl('https://localhost:3000').allowed).toBe(true);
    });

    it('应该允许 127.0.0.1', () => {
      expect(isAllowedLocalUrl('http://127.0.0.1:8080').allowed).toBe(true);
    });

    it('应该拒绝 0.0.0.0', () => {
      expect(isAllowedLocalUrl('http://0.0.0.0:3000').allowed).toBe(false);
    });

    it('应该拒绝非 http/https 协议', () => {
      expect(isAllowedLocalUrl('ftp://localhost').allowed).toBe(false);
      expect(isAllowedLocalUrl('file:///etc/passwd').allowed).toBe(false);
    });

    it('应该拒绝无效 URL', () => {
      expect(isAllowedLocalUrl('not-a-url').allowed).toBe(false);
    });

    it('默认应该拒绝私有网络 IP', () => {
      expect(isAllowedLocalUrl('http://192.168.1.1:3000').allowed).toBe(false);
      expect(isAllowedLocalUrl('http://10.0.0.1:3000').allowed).toBe(false);
    });

    it('开启外网访问后应该允许任意地址', () => {
      const config = { allowExternalAccess: true, enableDnsRebindingProtection: true };
      expect(isAllowedLocalUrl('http://192.168.1.1:3000', config).allowed).toBe(true);
      expect(isAllowedLocalUrl('http://example.com', config).allowed).toBe(true);
    });
  });

  describe('sanitizeString', () => {
    it('应该返回正常字符串', () => {
      expect(sanitizeString('hello world')).toBe('hello world');
    });

    it('应该移除控制字符', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
      expect(sanitizeString('test\x07beep')).toBe('testbeep');
    });

    it('应该保留换行和制表符', () => {
      expect(sanitizeString('hello\nworld')).toBe('hello\nworld');
      expect(sanitizeString('hello\tworld')).toBe('hello\tworld');
    });

    it('应该拒绝非字符串', () => {
      expect(sanitizeString(123)).toBeNull();
      expect(sanitizeString(null)).toBeNull();
      expect(sanitizeString(undefined)).toBeNull();
    });

    it('应该拒绝超长字符串', () => {
      const longStr = 'a'.repeat(10001);
      expect(sanitizeString(longStr)).toBeNull();
    });

    it('应该允许自定义最大长度', () => {
      expect(sanitizeString('abc', 2)).toBeNull();
      expect(sanitizeString('ab', 2)).toBe('ab');
    });
  });

  describe('isValidId', () => {
    it('应该通过有效 ID', () => {
      expect(isValidId('abc123')).toBe(true);
      expect(isValidId('member-default')).toBe(true);
      expect(isValidId('task_123')).toBe(true);
      expect(isValidId('ABC')).toBe(true);
    });

    it('应该拒绝无效 ID', () => {
      expect(isValidId('')).toBe(false);
      expect(isValidId('a'.repeat(101))).toBe(false);
      expect(isValidId('hello world')).toBe(false); // 空格
      expect(isValidId('test@email')).toBe(false); // @
      expect(isValidId(123)).toBe(false);
      expect(isValidId(null)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('应该通过有效 URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?q=1')).toBe(true);
    });

    it('应该拒绝无效 URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(123)).toBe(false);
    });

    it('应该拒绝非允许协议', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('ws://example.com', ['http:', 'https:'])).toBe(false);
    });

    it('应该支持自定义协议', () => {
      expect(isValidUrl('ws://example.com', ['ws:', 'wss:'])).toBe(true);
    });
  });

  describe('validateRequestBodySize', () => {
    it('应该通过小请求体', () => {
      expect(validateRequestBodySize({ key: 'value' })).toBe(true);
    });

    it('应该拒绝超大请求体', () => {
      const large = { data: 'x'.repeat(REQUEST_LIMITS.MAX_BODY_SIZE + 1) };
      expect(validateRequestBodySize(large)).toBe(false);
    });

    it('应该支持自定义大小限制', () => {
      expect(validateRequestBodySize({ key: 'value' }, 5)).toBe(false);
      expect(validateRequestBodySize({ a: 1 }, 100)).toBe(true);
    });

    it('应该处理循环引用', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(validateRequestBodySize(circular)).toBe(false);
    });
  });
});
