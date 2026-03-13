/**
 * Base58 ID 生成器 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateIdWithPrefix,
  isUuidFormat,
  uuidToBase58,
  normalizeId,
  normalizeIds,
  generateSessionId,
  generateMessageId,
} from '@/lib/id';

describe('ID Generator', () => {
  describe('generateId', () => {
    it('应该生成非空字符串', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('应该生成约 11 字符的 Base58 ID', () => {
      const id = generateId();
      // 8 字节随机数据 Base58 编码通常为 10-12 字符
      expect(id.length).toBeGreaterThanOrEqual(8);
      expect(id.length).toBeLessThanOrEqual(14);
    });

    it('应该只包含 Base58 字符集', () => {
      const base58Chars = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
      for (let i = 0; i < 100; i++) {
        const id = generateId();
        expect(id).toMatch(base58Chars);
      }
    });

    it('应该生成唯一 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('generateIdWithPrefix', () => {
    it('应该生成带前缀的 ID', () => {
      const id = generateIdWithPrefix('chat');
      expect(id).toMatch(/^chat-[a-zA-Z0-9]+$/);
    });

    it('应该使用不同前缀', () => {
      const chatId = generateSessionId();
      const msgId = generateMessageId();
      expect(chatId.startsWith('chat-')).toBe(true);
      expect(msgId.startsWith('msg-')).toBe(true);
    });
  });

  describe('isUuidFormat', () => {
    it('应该识别有效 UUID', () => {
      expect(isUuidFormat('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUuidFormat('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    });

    it('应该拒绝非 UUID 格式', () => {
      expect(isUuidFormat('not-a-uuid')).toBe(false);
      expect(isUuidFormat('abc123')).toBe(false);
      expect(isUuidFormat('')).toBe(false);
      expect(isUuidFormat('550e8400e29b41d4a716446655440000')).toBe(false); // 缺少连字符
    });
  });

  describe('uuidToBase58', () => {
    it('应该确定性转换', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result1 = uuidToBase58(uuid);
      const result2 = uuidToBase58(uuid);
      expect(result1).toBe(result2);
    });

    it('应该返回较短的 Base58 字符串', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = uuidToBase58(uuid);
      expect(result.length).toBeLessThan(36); // UUID 是 36 字符
      expect(result.length).toBeGreaterThan(0);
    });

    it('不同 UUID 应该产生不同结果', () => {
      const id1 = uuidToBase58('550e8400-e29b-41d4-a716-446655440000');
      const id2 = uuidToBase58('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(id1).not.toBe(id2);
    });
  });

  describe('normalizeId', () => {
    it('UUID 格式应该转换为 Base58', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = normalizeId(uuid);
      expect(result).not.toBe(uuid);
      expect(result).toBe(uuidToBase58(uuid));
    });

    it('非 UUID 格式应该原样返回', () => {
      const id = 'abc123XYZ';
      expect(normalizeId(id)).toBe(id);
    });

    it('空字符串应该原样返回', () => {
      expect(normalizeId('')).toBe('');
    });
  });

  describe('normalizeIds', () => {
    it('应该批量规范化', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const shortId = 'abc123';
      const result = normalizeIds([uuid, shortId]);
      expect(result[0]).toBe(uuidToBase58(uuid));
      expect(result[1]).toBe(shortId);
    });

    it('空数组应该返回空数组', () => {
      expect(normalizeIds([])).toEqual([]);
    });
  });
});
