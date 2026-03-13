/**
 * 日志工具
 * 
 * 根据环境控制日志输出级别
 * 
 * 使用示例：
 * ```typescript
 * import { logger } from '@/lib/logger';
 * 
 * logger.debug('Debug message');
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message');
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 从环境变量获取当前日志级别
const getCurrentLogLevel = (): LogLevel => {
  if (typeof process === 'undefined') return 'info';
  
  const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  
  // 生产环境默认只显示 warn 和 error
  if (process.env.NODE_ENV === 'production') {
    return 'warn';
  }
  
  return 'debug';
};

const currentLevel = getCurrentLogLevel();

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
};

/**
 * 用于 DataProvider 等组件的专用日志
 */
export const dataLogger = {
  debug: (component: string, message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log(`[${component}] ${message}`, ...args);
    }
  },
};
