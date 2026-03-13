/**
 * API 限流 - 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

describe('RATE_LIMITS 配置', () => {
  it('应该有 5 种预定义配置', () => {
    expect(RATE_LIMITS.STRICT).toBeDefined();
    expect(RATE_LIMITS.STANDARD).toBeDefined();
    expect(RATE_LIMITS.RELAXED).toBeDefined();
    expect(RATE_LIMITS.CHAT).toBeDefined();
    expect(RATE_LIMITS.CREATE).toBeDefined();
  });

  it('每种配置都应该有 windowMs 和 maxRequests', () => {
    for (const [name, config] of Object.entries(RATE_LIMITS)) {
      expect(config.windowMs, `${name}.windowMs`).toBeGreaterThan(0);
      expect(config.maxRequests, `${name}.maxRequests`).toBeGreaterThan(0);
    }
  });

  it('限制等级应该递增：STRICT < CHAT < CREATE < STANDARD < RELAXED', () => {
    expect(RATE_LIMITS.STRICT.maxRequests).toBeLessThan(RATE_LIMITS.CHAT.maxRequests);
    expect(RATE_LIMITS.CHAT.maxRequests).toBeLessThan(RATE_LIMITS.CREATE.maxRequests);
    expect(RATE_LIMITS.CREATE.maxRequests).toBeLessThan(RATE_LIMITS.STANDARD.maxRequests);
    expect(RATE_LIMITS.STANDARD.maxRequests).toBeLessThan(RATE_LIMITS.RELAXED.maxRequests);
  });
});

describe('checkRateLimit', () => {
  it('首次请求应该通过', () => {
    const uniqueId = `test-first-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(uniqueId, RATE_LIMITS.STANDARD);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMITS.STANDARD.maxRequests - 1);
  });

  it('连续请求应该递减 remaining', () => {
    const uniqueId = `test-decrement-${Date.now()}-${Math.random()}`;
    const config = { windowMs: 60000, maxRequests: 5 };

    const r1 = checkRateLimit(uniqueId, config);
    expect(r1.remaining).toBe(4);

    const r2 = checkRateLimit(uniqueId, config);
    expect(r2.remaining).toBe(3);

    const r3 = checkRateLimit(uniqueId, config);
    expect(r3.remaining).toBe(2);
  });

  it('超过限制后应该拒绝', () => {
    const uniqueId = `test-exceed-${Date.now()}-${Math.random()}`;
    const config = { windowMs: 60000, maxRequests: 3 };

    checkRateLimit(uniqueId, config);
    checkRateLimit(uniqueId, config);
    checkRateLimit(uniqueId, config);

    const result = checkRateLimit(uniqueId, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter!).toBeGreaterThan(0);
  });

  it('不同标识符应该独立计数', () => {
    const id1 = `test-independent-a-${Date.now()}-${Math.random()}`;
    const id2 = `test-independent-b-${Date.now()}-${Math.random()}`;
    const config = { windowMs: 60000, maxRequests: 2 };

    checkRateLimit(id1, config);
    checkRateLimit(id1, config);

    // id1 已耗尽，id2 仍然可用
    const r1 = checkRateLimit(id1, config);
    const r2 = checkRateLimit(id2, config);

    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
  });

  it('应该支持自定义 keyGenerator', () => {
    const uniqueId = `test-keygen-${Date.now()}-${Math.random()}`;
    const config = {
      windowMs: 60000,
      maxRequests: 2,
      keyGenerator: (id: string) => `custom:${id}`,
    };

    const r1 = checkRateLimit(uniqueId, config);
    expect(r1.allowed).toBe(true);
  });

  it('窗口过期后应该重置', () => {
    const uniqueId = `test-reset-${Date.now()}-${Math.random()}`;
    // 使用非常短的窗口
    const config = { windowMs: 1, maxRequests: 1 };

    checkRateLimit(uniqueId, config);

    // 等待窗口过期
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit(uniqueId, config);
        expect(result.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });
});

describe('getClientIdentifier', () => {
  it('应该优先使用 X-Forwarded-For', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '10.0.0.1',
      },
    });
    expect(getClientIdentifier(request)).toBe('1.2.3.4');
  });

  it('应该回退到 X-Real-IP', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIdentifier(request)).toBe('10.0.0.1');
  });

  it('无 IP 头时应该返回 unknown', () => {
    const request = new Request('http://localhost');
    expect(getClientIdentifier(request)).toBe('unknown');
  });

  it('应该取 X-Forwarded-For 的第一个 IP', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  1.1.1.1 , 2.2.2.2 , 3.3.3.3 ' },
    });
    expect(getClientIdentifier(request)).toBe('1.1.1.1');
  });
});

describe('createRateLimitResponse', () => {
  it('应该返回 429 状态码', () => {
    const response = createRateLimitResponse(30);
    expect(response.status).toBe(429);
  });

  it('应该设置 Retry-After 头', () => {
    const response = createRateLimitResponse(60);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('应该设置 Content-Type 为 JSON', () => {
    const response = createRateLimitResponse(10);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('响应体应该包含错误信息和 retryAfter', async () => {
    const response = createRateLimitResponse(45);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.retryAfter).toBe(45);
  });
});
