/**
 * 登录限流模块
 * 
 * 实现账户级和 IP 级登录限流，防止暴力破解攻击
 * 
 * 限流策略：
 * - 单账户：5 次/15 分钟
 * - 单 IP：10 次/15 分钟
 * - 惩罚期：失败后锁定 15 分钟
 */

// ============================================================
// 类型定义
// ============================================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingMs: number;
  reason?: 'account_locked' | 'ip_locked';
  attemptsRemaining?: number;
}

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  // 时间窗口（毫秒）
  windowMs: 15 * 60 * 1000, // 15 分钟
  
  // 单账户限制
  maxAccountAttempts: 5,
  
  // 单 IP 限制
  maxIpAttempts: 10,
  
  // 清理间隔（毫秒）
  cleanupIntervalMs: 60 * 1000, // 1 分钟
};

// ============================================================
// 存储层
// ============================================================

// 内存存储（单进程适用）
// 生产环境建议使用 Redis
const accountAttempts = new Map<string, LoginAttempt>();
const ipAttempts = new Map<string, LoginAttempt>();

// 定期清理过期记录
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer() {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const expireThreshold = now - CONFIG.windowMs;
    
    // 清理账户记录
    for (const [key, attempt] of accountAttempts.entries()) {
      if (attempt.lastAttempt < expireThreshold) {
        accountAttempts.delete(key);
      }
    }
    
    // 清理 IP 记录
    for (const [key, attempt] of ipAttempts.entries()) {
      if (attempt.lastAttempt < expireThreshold) {
        ipAttempts.delete(key);
      }
    }
  }, CONFIG.cleanupIntervalMs);
}

// 启动清理定时器
if (typeof window === 'undefined') {
  startCleanupTimer();
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 检查登录限流
 * 
 * @param identifier 用户标识（email 或 userId）
 * @param ipAddress IP 地址
 * @returns 限流结果
 */
export function checkLoginRateLimit(
  identifier: string,
  ipAddress: string
): RateLimitResult {
  const now = Date.now();
  const expireThreshold = now - CONFIG.windowMs;
  
  // 检查账户级限流
  const accountRecord = accountAttempts.get(identifier);
  if (accountRecord && accountRecord.lastAttempt > expireThreshold) {
    if (accountRecord.count >= CONFIG.maxAccountAttempts) {
      const remainingMs = accountRecord.lastAttempt + CONFIG.windowMs - now;
      return {
        allowed: false,
        remainingMs,
        reason: 'account_locked',
        attemptsRemaining: 0,
      };
    }
  }
  
  // 检查 IP 级限流
  const ipRecord = ipAttempts.get(ipAddress);
  if (ipRecord && ipRecord.lastAttempt > expireThreshold) {
    if (ipRecord.count >= CONFIG.maxIpAttempts) {
      const remainingMs = ipRecord.lastAttempt + CONFIG.windowMs - now;
      return {
        allowed: false,
        remainingMs,
        reason: 'ip_locked',
        attemptsRemaining: 0,
      };
    }
  }
  
  // 计算剩余尝试次数
  const accountAttemptsRemaining = accountRecord
    ? Math.max(0, CONFIG.maxAccountAttempts - accountRecord.count)
    : CONFIG.maxAccountAttempts;
  const ipAttemptsRemaining = ipRecord
    ? Math.max(0, CONFIG.maxIpAttempts - ipRecord.count)
    : CONFIG.maxIpAttempts;
  
  return {
    allowed: true,
    remainingMs: 0,
    attemptsRemaining: Math.min(accountAttemptsRemaining, ipAttemptsRemaining),
  };
}

/**
 * 记录登录尝试
 * 
 * @param identifier 用户标识
 * @param ipAddress IP 地址
 * @param success 是否成功
 */
export function recordLoginAttempt(
  identifier: string,
  ipAddress: string,
  success: boolean
): void {
  const now = Date.now();
  
  if (success) {
    // 登录成功，清除失败记录
    accountAttempts.delete(identifier);
    // 不清除 IP 记录，因为可能还有其他账户在尝试
    return;
  }
  
  // 登录失败，增加计数
  const accountRecord = accountAttempts.get(identifier);
  if (accountRecord && now - accountRecord.firstAttempt < CONFIG.windowMs) {
    accountRecord.count++;
    accountRecord.lastAttempt = now;
  } else {
    accountAttempts.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
  }
  
  const ipRecord = ipAttempts.get(ipAddress);
  if (ipRecord && now - ipRecord.firstAttempt < CONFIG.windowMs) {
    ipRecord.count++;
    ipRecord.lastAttempt = now;
  } else {
    ipAttempts.set(ipAddress, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
  }
}

/**
 * 清除账户锁定（管理员操作）
 */
export function clearAccountLock(identifier: string): void {
  accountAttempts.delete(identifier);
}

/**
 * 获取当前限流状态（调试用）
 */
export function getRateLimitStatus(identifier: string, ipAddress: string) {
  const now = Date.now();
  const expireThreshold = now - CONFIG.windowMs;
  
  const accountRecord = accountAttempts.get(identifier);
  const ipRecord = ipAttempts.get(ipAddress);
  
  return {
    account: accountRecord && accountRecord.lastAttempt > expireThreshold
      ? {
          attempts: accountRecord.count,
          remainingMs: accountRecord.lastAttempt + CONFIG.windowMs - now,
          locked: accountRecord.count >= CONFIG.maxAccountAttempts,
        }
      : null,
    ip: ipRecord && ipRecord.lastAttempt > expireThreshold
      ? {
          attempts: ipRecord.count,
          remainingMs: ipRecord.lastAttempt + CONFIG.windowMs - now,
          locked: ipRecord.count >= CONFIG.maxIpAttempts,
        }
      : null,
  };
}

/**
 * 格式化剩余时间
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '0 秒';
  
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes} 分 ${seconds} 秒`;
  }
  return `${seconds} 秒`;
}
