/**
 * 对话信道数据交互模块 - 结构化日志
 * 
 * 提供：
 * - 结构化日志（JSON 格式）
 * - 请求 ID 追踪
 * - 开发/生产环境不同日志级别
 * - 执行耗时统计
 */

import type { LogLevel, LogEntry, ActionType } from './types';

/**
 * 日志配置
 */
interface LoggerConfig {
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 是否输出到控制台 */
  console: boolean;
  /** 是否输出到文件（服务端） */
  file: boolean;
  /** 日志文件路径 */
  filePath?: string;
  /** 是否包含堆栈跟踪 */
  includeStack: boolean;
}

/** 日志级别优先级 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 默认配置 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  console: true,
  file: false,
  includeStack: process.env.NODE_ENV !== 'production',
};

/**
 * 对话信道日志器
 */
export class ChannelLogger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 记录日志
   */
  log(
    level: LogLevel,
    requestId: string,
    message: string,
    options?: {
      action?: ActionType;
      data?: Record<string, unknown>;
      error?: Error | string;
      duration?: number;
    }
  ): void {
    // 检查日志级别
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      action: options?.action,
      message,
      data: options?.data,
      error: options?.error instanceof Error 
        ? `${options.error.message}\n${options.error.stack || ''}`
        : options?.error,
      duration: options?.duration,
    };

    // 存储日志
    this.entries.push(entry);

    // 控制台输出
    if (this.config.console) {
      this.logToConsole(entry);
    }
  }

  /**
   * Debug 日志
   */
  debug(
    requestId: string,
    message: string,
    options?: { action?: ActionType; data?: Record<string, unknown> }
  ): void {
    this.log('debug', requestId, message, options);
  }

  /**
   * Info 日志
   */
  info(
    requestId: string,
    message: string,
    options?: { action?: ActionType; data?: Record<string, unknown> }
  ): void {
    this.log('info', requestId, message, options);
  }

  /**
   * Warn 日志
   */
  warn(
    requestId: string,
    message: string,
    options?: { action?: ActionType; data?: Record<string, unknown>; error?: Error | string }
  ): void {
    this.log('warn', requestId, message, options);
  }

  /**
   * Error 日志
   */
  error(
    requestId: string,
    message: string,
    options?: { action?: ActionType; data?: Record<string, unknown>; error?: Error | string }
  ): void {
    this.log('error', requestId, message, options);
  }

  /**
   * 记录操作开始
   */
  actionStart(
    requestId: string,
    action: ActionType,
    params?: Record<string, unknown>
  ): number {
    this.debug(requestId, `开始执行: ${action}`, {
      action,
      data: this.sanitizeParams(params),
    });
    return Date.now();
  }

  /**
   * 记录操作结束
   */
  actionEnd(
    requestId: string,
    action: ActionType,
    startTime: number,
    success: boolean,
    message?: string
  ): void {
    const duration = Date.now() - startTime;
    const level: LogLevel = success ? 'info' : 'error';
    this.log(level, requestId, message || `执行完成: ${action}`, {
      action,
      duration,
    });
  }

  /**
   * 控制台输出
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.requestId.slice(0, 8)}]`;
    const action = entry.action ? ` [${entry.action}]` : '';
    const duration = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';
    
    const output = `${prefix}${action} ${entry.message}${duration}`;
    
    switch (entry.level) {
      case 'debug':
        console.log('\x1b[90m%s\x1b[0m', output); // 灰色
        break;
      case 'info':
        console.log('\x1b[36m%s\x1b[0m', output); // 青色
        break;
      case 'warn':
        console.warn('\x1b[33m%s\x1b[0m', output); // 黄色
        break;
      case 'error':
        console.error('\x1b[31m%s\x1b[0m', output); // 红色
        if (entry.error) {
          console.error('\x1b[31m%s\x1b[0m', entry.error);
        }
        break;
    }

    // 详细数据（debug 模式）
    if (entry.data && this.config.minLevel === 'debug') {
      console.log('\x1b[90m  Data: %j\x1b[0m', entry.data);
    }
  }

  /**
   * 清理敏感参数
   */
  private sanitizeParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!params) return undefined;
    
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'api_token'];
    
    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = value.slice(0, 200) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 获取所有日志
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * 获取指定请求的日志
   */
  getRequestLogs(requestId: string): LogEntry[] {
    return this.entries.filter(e => e.requestId === requestId);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * 导出为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}

// ============================================================================
// 全局日志实例
// ============================================================================

/** 全局日志器 */
let globalLogger: ChannelLogger | null = null;

/**
 * 获取全局日志器
 */
export function getLogger(): ChannelLogger {
  if (!globalLogger) {
    globalLogger = new ChannelLogger();
  }
  return globalLogger;
}

/**
 * 配置全局日志器
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalLogger = new ChannelLogger(config);
}

// ============================================================================
// 请求 ID 生成
// ============================================================================

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `req_${timestamp}_${random}`;
}
