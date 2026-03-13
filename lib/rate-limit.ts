/**
 * API 限流中间件
 * 使用内存存储实现简单的滑动窗口限流
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  // 时间窗口（毫秒）
  windowMs: number;
  // 窗口内最大请求数
  maxRequests: number;
  // 可选：自定义 key 生成函数
  keyGenerator?: (identifier: string) => string;
}

// 内存存储（生产环境应使用 Redis）
const rateLimitStore = new Map<string, RateLimitEntry>();

// 定时器清理键
const cleanupTimerKey = '__teamclaw_rate_limit_cleanup_timer__';

/**
 * 启动清理定时器（带防止重复启动保护）
 */
function startCleanupTimer(): void {
  const globalObj = globalThis as Record<string, unknown>;
  
  // 如果已有定时器在运行，先清理
  if (globalObj[cleanupTimerKey]) {
    clearInterval(globalObj[cleanupTimerKey] as ReturnType<typeof setInterval>);
  }
  
  // 启动新的清理定时器
  globalObj[cleanupTimerKey] = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // 每分钟清理一次
  
  // 确保进程退出时清理定时器（仅 Node.js 环境）
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    const cleanup = () => {
      if (globalObj[cleanupTimerKey]) {
        clearInterval(globalObj[cleanupTimerKey] as ReturnType<typeof setInterval>);
        globalObj[cleanupTimerKey] = null;
      }
    };
    
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('beforeExit', cleanup);
  }
}

// 仅在服务端启动清理定时器
if (typeof window === 'undefined') {
  startCleanupTimer();
}

/**
 * 预定义的限流配置
 */
export const RATE_LIMITS = {
  // 严格限制：每分钟 10 次（用于敏感操作）
  STRICT: { windowMs: 60000, maxRequests: 10 },
  // 标准限制：每分钟 60 次
  STANDARD: { windowMs: 60000, maxRequests: 60 },
  // 宽松限制：每分钟 120 次
  RELAXED: { windowMs: 60000, maxRequests: 120 },
  // AI 聊天：每分钟 20 次
  CHAT: { windowMs: 60000, maxRequests: 20 },
  // 创建操作：每分钟 30 次
  CREATE: { windowMs: 60000, maxRequests: 30 },
} as const;

/**
 * 检查限流
 * @param identifier 唯一标识符（如 IP 地址或用户 ID）
 * @param config 限流配置
 * @returns 是否允许请求，以及剩余配额信息
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.STANDARD
): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const now = Date.now();
  const key = config.keyGenerator ? config.keyGenerator(identifier) : `ratelimit:${identifier}`;
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // 创建新窗口
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    // 超过限制
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }
  
  // 增加计数
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * 获取客户端标识符
 * 优先使用 X-Forwarded-For，其次使用 X-Real-IP，最后使用连接 IP
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For 可能包含多个 IP，取第一个
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // 默认使用 unknown（无法获取真实 IP 时）
  return 'unknown';
}

/**
 * 限流响应构造器
 */
export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ 
      error: '请求频率过高，请稍后重试',
      retryAfter 
    }),
    { 
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      }
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * API 限流中间件包装器
 * 使用示例：
 * 
 * export const POST = withRateLimit(async (request) => {
 *   // 处理请求
 * }, RATE_LIMITS.STRICT);
 */
export function withRateLimit<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.STANDARD
): (request: T) => Promise<NextResponse> {
  return async (request: T) => {
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(identifier, config);
    
    if (!result.allowed) {
      return NextResponse.json(
        { error: '请求频率过高，请稍后重试', retryAfter: result.retryAfter },
        { 
          status: 429,
          headers: result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : undefined
        }
      );
    }
    
    const response = await handler(request);
    
    // 添加限流头信息
    response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(result.resetTime));
    
    return response;
  };
}
