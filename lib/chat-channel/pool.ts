/**
 * 对话信道 - Gateway 连接池
 * 
 * @deprecated 已弃用浏览器直连模式。TeamClaw 3.0 使用服务端代理模式，
 * 连接由 ServerGatewayClient 在服务端维护，无需前端连接池。
 * 
 * 此模块仅保留用于历史参考，请勿在新代码中使用。
 * 
 * @see lib/server-gateway-client.ts - 服务端 Gateway 客户端
 * 
 * 功能：
 * - 按用户会话隔离连接
 * - 连接复用和保活
 * - 预连接机制
 * - 连接池上限管理
 * 
 * @module lib/chat-channel/pool
 */

import { createGatewayClient, type OpenClawGatewayClient } from '@/lib/gateway-client';
import { getLogger, generateRequestId } from './logger';

const logger = getLogger();

/** 连接池配置 */
export interface ConnectionPoolConfig {
  /** 最大连接数 */
  maxConnections: number;
  /** 连接空闲超时（毫秒） */
  idleTimeoutMs: number;
  /** 心跳间隔（毫秒） */
  heartbeatIntervalMs: number;
  /** 预连接过期时间（毫秒） */
  prefetchExpiryMs: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxConnections: 100,
  idleTimeoutMs: 5 * 60 * 1000, // 5 分钟
  heartbeatIntervalMs: 30 * 1000, // 30 秒
  prefetchExpiryMs: 10 * 60 * 1000, // 10 分钟
};

/** 连接状态 */
type ConnectionState = 'idle' | 'active' | 'closed';

/** 池化连接 */
interface PooledConnection {
  /** 连接 ID */
  id: string;
  /** Gateway 客户端 */
  client: OpenClawGatewayClient;
  /** 用户 ID */
  userId: string;
  /** 会话键 */
  sessionKey: string;
  /** 连接状态 */
  state: ConnectionState;
  /** 最后使用时间 */
  lastUsedAt: number;
  /** 创建时间 */
  createdAt: number;
  /** 使用计数 */
  useCount: number;
}

/** 预连接记录 */
interface PrefetchRecord {
  userId: string;
  sessionKey: string;
  url: string;
  token: string;
  createdAt: number;
}

/**
 * Gateway 连接池管理器
 * 
 * 单例模式，全局统一管理 Gateway 连接
 */
export class GatewayConnectionPool {
  private static instance: GatewayConnectionPool | null = null;
  
  private pools = new Map<string, PooledConnection>();
  private prefetches = new Map<string, PrefetchRecord>();
  private config: ConnectionPoolConfig;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  
  /** 连接计数器 */
  private connectionCounter = 0;
  
  private constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startMaintenance();
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<ConnectionPoolConfig>): GatewayConnectionPool {
    if (!GatewayConnectionPool.instance) {
      GatewayConnectionPool.instance = new GatewayConnectionPool(config);
    }
    return GatewayConnectionPool.instance;
  }
  
  /**
   * 重置单例（测试用）
   */
  static reset(): void {
    if (GatewayConnectionPool.instance) {
      GatewayConnectionPool.instance.destroy();
      GatewayConnectionPool.instance = null;
    }
  }
  
  /**
   * 获取或创建连接
   * 
   * @param userId 用户 ID
   * @param sessionKey 会话键
   * @param url Gateway URL
   * @param token Gateway Token
   * @returns 池化连接
   */
  async acquire(
    userId: string,
    sessionKey: string,
    url: string,
    token: string
  ): Promise<PooledConnection> {
    const key = this.getKey(userId, sessionKey);
    
    // 1. 尝试复用现有连接
    const existing = this.pools.get(key);
    if (existing && this.isHealthy(existing)) {
      existing.state = 'active';
      existing.lastUsedAt = Date.now();
      existing.useCount++;
      logger.info(generateRequestId(), `Connection reused: ${key}`, { data: { useCount: existing.useCount } });
      return existing;
    }
    
    // 2. 移除不健康的连接
    if (existing) {
      await this.remove(key);
    }
    
    // 3. 检查连接池上限
    if (this.pools.size >= this.config.maxConnections) {
      await this.evictLRU();
    }
    
    // 4. 创建新连接
    const conn = await this.createConnection(userId, sessionKey, url, token);
    this.pools.set(key, conn);
    
    logger.info(generateRequestId(), `Connection created: ${key}`, { data: { total: this.pools.size } });
    return conn;
  }
  
  /**
   * 预连接 - 用户登录/注册时调用
   * 
   * @param userId 用户 ID
   * @param url Gateway URL
   * @param token Gateway Token
   */
  async prefetch(userId: string, url: string, token: string): Promise<void> {
    const sessionKey = this.getUserSessionKey(userId);
    const key = this.getKey(userId, sessionKey);
    
    // 记录预连接请求
    this.prefetches.set(key, {
      userId,
      sessionKey,
      url,
      token,
      createdAt: Date.now(),
    });
    
    // 异步建立连接（不阻塞）
    this.acquire(userId, sessionKey, url, token).catch((err) => {
      logger.warn(generateRequestId(), `Prefetch failed for ${userId}:`, { error: err });
    });
    
    logger.info(generateRequestId(), `Prefetch scheduled: ${key}`);
  }
  
  /**
   * 检查是否有预连接
   */
  hasPrefetch(userId: string): boolean {
    const sessionKey = this.getUserSessionKey(userId);
    const key = this.getKey(userId, sessionKey);
    const record = this.prefetches.get(key);
    
    if (!record) return false;
    
    // 检查是否过期
    const expired = Date.now() - record.createdAt > this.config.prefetchExpiryMs;
    if (expired) {
      this.prefetches.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 释放连接（标记为空闲）
   */
  release(userId: string, sessionKey: string): void {
    const key = this.getKey(userId, sessionKey);
    const conn = this.pools.get(key);
    
    if (conn) {
      conn.state = 'idle';
      conn.lastUsedAt = Date.now();
      logger.debug(generateRequestId(), `Connection released: ${key}`);
    }
  }
  
  /**
   * 关闭并移除连接
   */
  async remove(key: string): Promise<void> {
    const conn = this.pools.get(key);
    if (!conn) return;
    
    conn.state = 'closed';
    conn.client.disconnect();
    this.pools.delete(key);
    
    logger.info(generateRequestId(), `Connection removed: ${key}`);
  }
  
  /**
   * 获取连接统计
   */
  getStats(): {
    total: number;
    active: number;
    idle: number;
    prefetchCount: number;
  } {
    let active = 0;
    let idle = 0;
    
    for (const conn of this.pools.values()) {
      if (conn.state === 'active') active++;
      else if (conn.state === 'idle') idle++;
    }
    
    return {
      total: this.pools.size,
      active,
      idle,
      prefetchCount: this.prefetches.size,
    };
  }
  
  /**
   * 销毁连接池
   */
  destroy(): void {
    // 停止定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // 关闭所有连接
    for (const [key, conn] of this.pools) {
      conn.client.disconnect();
      logger.info(generateRequestId(), `Connection closed on destroy: ${key}`);
    }
    
    this.pools.clear();
    this.prefetches.clear();
    
    logger.info(generateRequestId(), 'Connection pool destroyed');
  }
  
  // ============ 私有方法 ============
  
  private getKey(userId: string, sessionKey: string): string {
    return `${userId}:${sessionKey}`;
  }
  
  private getUserSessionKey(userId: string): string {
    // 使用多用户专用会话键格式
    return `dm:${userId}`;
  }
  
  private isHealthy(conn: PooledConnection): boolean {
    return conn.state !== 'closed' && conn.client.isConnected;
  }
  
  private async createConnection(
    userId: string,
    sessionKey: string,
    url: string,
    token: string
  ): Promise<PooledConnection> {
    const client = createGatewayClient(url, token);
    
    // 建立连接
    await client.connect();
    
    // 订阅用户专属会话
    // Note: Gateway 协议通过 sessionKey 路由，不需要显式订阅
    
    this.connectionCounter++;
    
    return {
      id: `conn-${this.connectionCounter}`,
      client,
      userId,
      sessionKey,
      state: 'active',
      lastUsedAt: Date.now(),
      createdAt: Date.now(),
      useCount: 1,
    };
  }
  
  /**
   * 淘汰最久未使用的连接
   */
  private async evictLRU(): Promise<void> {
    let oldest: { key: string; lastUsedAt: number } | null = null;
    
    for (const [key, conn] of this.pools) {
      if (conn.state === 'idle') {
        if (!oldest || conn.lastUsedAt < oldest.lastUsedAt) {
          oldest = { key, lastUsedAt: conn.lastUsedAt };
        }
      }
    }
    
    if (oldest) {
      await this.remove(oldest.key);
      logger.info(generateRequestId(), `LRU eviction: ${oldest.key}`);
    } else {
      // 没有空闲连接，抛出错误
      throw new Error('Connection pool exhausted, no idle connections to evict');
    }
  }
  
  /**
   * 启动维护定时器
   */
  private startMaintenance(): void {
    // 心跳保活
    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, this.config.heartbeatIntervalMs);
    
    // 清理过期连接和预连接
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 每分钟清理一次
  }
  
  /**
   * 心跳保活
   */
  private heartbeat(): void {
    for (const [key, conn] of this.pools) {
      if (!conn.client.isConnected) {
        logger.warn(generateRequestId(), `Connection lost: ${key}`);
        this.remove(key).catch(console.error);
      }
    }
  }
  
  /**
   * 清理过期资源
   */
  private cleanup(): void {
    const now = Date.now();
    
    // 清理过期预连接记录
    for (const [key, record] of this.prefetches) {
      if (now - record.createdAt > this.config.prefetchExpiryMs) {
        this.prefetches.delete(key);
        logger.debug(generateRequestId(), `Prefetch expired: ${key}`);
      }
    }
    
    // 清理空闲超时连接
    for (const [key, conn] of this.pools) {
      if (conn.state === 'idle') {
        if (now - conn.lastUsedAt > this.config.idleTimeoutMs) {
          this.remove(key).catch(console.error);
          logger.info(generateRequestId(), `Idle connection timeout: ${key}`);
        }
      }
    }
  }
}

/** 全局连接池实例 */
export const connectionPool = GatewayConnectionPool.getInstance();

/**
 * 预连接函数 - 用户登录/注册时调用
 */
export async function prefetchConnection(
  userId: string,
  url: string,
  token: string
): Promise<void> {
  await connectionPool.prefetch(userId, url, token);
}

/**
 * 获取连接统计
 */
export function getConnectionStats(): ReturnType<GatewayConnectionPool['getStats']> {
  return connectionPool.getStats();
}
