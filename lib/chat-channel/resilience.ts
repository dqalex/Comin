/**
 * 对话信道 - 容灾与弹性模块
 *
 * @deprecated 已弃用浏览器直连模式。TeamClaw 3.0 使用服务端代理模式，
 * 容灾逻辑由 ServerGatewayClient 内置（自动重连、心跳保活）。
 * 
 * 此模块仅保留用于历史参考，请勿在新代码中使用。
 * 
 * @see lib/server-gateway-client.ts - 服务端 Gateway 客户端（已内置容灾）
 *
 * 功能：
 * - 熔断器模式（Circuit Breaker）
 * - 主备切换
 * - 自动重连
 * - 降级策略
 *
 * @module lib/chat-channel/resilience
 */

import type { OpenClawGatewayClient } from '@/lib/gateway-client';
import { createGatewayClient } from '@/lib/gateway-client';
import { getLogger, generateRequestId } from './logger';

const logger = getLogger();

/** 熔断器状态 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** 熔断器配置 */
export interface CircuitBreakerConfig {
  /** 失败阈值（触发熔断） */
  failureThreshold: number;
  /** 熔断持续时间（毫秒） */
  resetTimeout: number;
  /** 半开状态成功阈值（恢复） */
  successThreshold: number;
}

/** 默认熔断器配置 */
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 3,
};

/**
 * 熔断器实现
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * 执行受保护的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // 检查是否应该进入半开状态
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info(generateRequestId(), 'Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 是否处于打开状态
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * 记录成功
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        logger.info(generateRequestId(), 'Circuit breaker CLOSED (recovered)');
      }
    }
  }

  /**
   * 记录失败
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // 半开状态失败，立即重新熔断
      this.state = 'OPEN';
      logger.warn(generateRequestId(), 'Circuit breaker OPEN (half-open failed)');
    } else if (this.failureCount >= this.config.failureThreshold) {
      // 达到失败阈值，触发熔断
      this.state = 'OPEN';
      logger.warn(generateRequestId(), `Circuit breaker OPEN (threshold: ${this.config.failureThreshold})`);
    }
  }

  /**
   * 是否应该尝试重置（进入半开状态）
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }
}

/** 弹性 Gateway 客户端配置 */
export interface ResilientGatewayConfig {
  /** 主节点配置 */
  primary: {
    url: string;
    token: string;
  };
  /** 备节点配置（可选） */
  secondary?: {
    url: string;
    token: string;
  };
  /** 熔断器配置 */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** 重连间隔（毫秒） */
  reconnectInterval: number;
  /** 最大重连次数 */
  maxReconnectAttempts: number;
}

/** 默认弹性配置 */
const DEFAULT_RESILIENT_CONFIG: Partial<ResilientGatewayConfig> = {
  reconnectInterval: 1000,
  maxReconnectAttempts: 10,
};

/**
 * 弹性 Gateway 客户端
 *
 * 特性：
 * - 主备自动切换
 * - 熔断保护
 * - 自动重连
 * - 双写模式（重要消息）
 */
export class ResilientGatewayClient {
  private primary: OpenClawGatewayClient;
  private secondary: OpenClawGatewayClient | null = null;
  private circuitBreaker: CircuitBreaker;
  private config: ResilientGatewayConfig;
  private currentNode: 'primary' | 'secondary' = 'primary';
  private reconnectAttempts = 0;

  constructor(config: ResilientGatewayConfig) {
    this.config = { ...DEFAULT_RESILIENT_CONFIG, ...config } as ResilientGatewayConfig;

    // 创建主节点
    this.primary = createGatewayClient(config.primary.url, config.primary.token);

    // 创建备节点
    if (config.secondary) {
      this.secondary = createGatewayClient(config.secondary.url, config.secondary.token);
    }

    // 创建熔断器
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  }

  /**
   * 发送消息（自动主备切换）
   */
  async send<T>(message: unknown): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      try {
        // 尝试主节点
        if (this.currentNode === 'primary') {
          return await this.sendToPrimary<T>(message);
        }

        // 尝试备节点
        if (this.secondary) {
          return await this.sendToSecondary<T>(message);
        }

        throw new Error('No available Gateway node');
      } catch (err) {
        // 主节点失败，切换到备节点
        if (this.currentNode === 'primary' && this.secondary) {
          logger.warn(generateRequestId(), 'Primary failed, switching to secondary');
          this.currentNode = 'secondary';
          return await this.sendToSecondary<T>(message);
        }
        throw err;
      }
    });
  }

  /**
   * 双写模式（重要消息同时写入主备）
   *
   * 至少一个成功即算成功
   */
  async sendDualWrite<T>(message: unknown): Promise<T> {
    const results: Promise<T>[] = [];

    // 主节点写入
    results.push(
      this.sendToPrimary<T>(message).catch((err) => {
        logger.warn(generateRequestId(), 'Primary dual-write failed', { error: err as Error });
        throw err;
      })
    );

    // 备节点写入
    if (this.secondary) {
      results.push(
        this.sendToSecondary<T>(message).catch((err) => {
          logger.warn(generateRequestId(), 'Secondary dual-write failed', { error: err as Error });
          throw err;
        })
      );
    }

    // 等待结果，至少一个成功
    const settled = await Promise.allSettled(results);
    const success = settled.find((r) => r.status === 'fulfilled');

    if (success) {
      return (success as PromiseFulfilledResult<T>).value;
    }

    throw new Error('Both primary and secondary failed');
  }

  /**
   * 连接（主备都连接）
   */
  async connect(): Promise<void> {
    try {
      await this.primary.connect();
      logger.info(generateRequestId(), 'Primary Gateway connected');
    } catch (err) {
      logger.error(generateRequestId(), 'Primary Gateway connection failed', { error: err as Error });

      // 主节点失败，尝试备节点
      if (this.secondary) {
        this.currentNode = 'secondary';
        await this.secondary.connect();
        logger.info(generateRequestId(), 'Secondary Gateway connected (fallback)');
      } else {
        throw err;
      }
    }

    // 同时连接备节点（后台）
    if (this.secondary) {
      this.secondary.connect().catch(() => {
        // 备节点连接失败不影响主流程
      });
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.primary.disconnect();
    this.secondary?.disconnect();
    logger.info(generateRequestId(), 'Resilient Gateway disconnected');
  }

  /**
   * 自动重连
   */
  async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      throw new Error(`Max reconnect attempts (${this.config.maxReconnectAttempts}) reached`);
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    logger.info(generateRequestId(), `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    await sleep(delay);

    try {
      await this.connect();
      this.reconnectAttempts = 0;
      logger.info(generateRequestId(), 'Reconnected successfully');
    } catch (err) {
      // 继续重试
      await this.reconnect();
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    currentNode: 'primary' | 'secondary';
    circuitState: CircuitState;
    isConnected: boolean;
  } {
    return {
      currentNode: this.currentNode,
      circuitState: this.circuitBreaker.getState(),
      isConnected: this.currentNode === 'primary'
        ? this.primary.isConnected
        : this.secondary?.isConnected || false,
    };
  }

  // ============ 私有方法 ============

  private async sendToPrimary<T>(message: unknown): Promise<T> {
    // 通过 primary client 发送
    // Note: 实际发送逻辑依赖 gateway-client 的 request 方法
    return this.primary.request<T>('send', message as Record<string, unknown>);
  }

  private async sendToSecondary<T>(message: unknown): Promise<T> {
    if (!this.secondary) {
      throw new Error('Secondary node not configured');
    }
    return this.secondary.request<T>('send', message as Record<string, unknown>);
  }
}

/**
 * 工具函数：延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 弹性客户端工厂 */
export function createResilientClient(
  config: ResilientGatewayConfig
): ResilientGatewayClient {
  return new ResilientGatewayClient(config);
}
