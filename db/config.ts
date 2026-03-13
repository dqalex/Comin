/**
 * 数据库配置工厂
 * 
 * 根据 DATABASE_URL 环境变量自动选择数据库驱动：
 * - 未设置或 sqlite: 前缀 → SQLite（默认）
 * - postgres:// 或 postgresql:// 前缀 → PostgreSQL
 */

import { createSqliteConnection } from './adapters/sqlite';
import { createPostgresConnection, shouldUsePostgres } from './adapters/postgres';
import type BetterSqlite3 from 'better-sqlite3';

// 类型定义
export type DbType = ReturnType<typeof createSqliteConnection>['db'] | ReturnType<typeof createPostgresConnection>['db'];
type SqliteDatabase = InstanceType<typeof BetterSqlite3>;

let _db: DbType | null = null;
let _sqlite: SqliteDatabase | null = null;
let _sql: ReturnType<typeof import('postgres')> | null = null;

/**
 * 获取数据库实例（单例）
 * 
 * 根据环境变量自动选择 SQLite 或 PostgreSQL
 */
export function getDb(): DbType {
  if (_db) return _db;

  if (shouldUsePostgres()) {
    const { db, sql } = createPostgresConnection();
    _db = db;
    _sql = sql;
    return _db;
  }

  const { db, sqlite } = createSqliteConnection();
  _db = db;
  _sqlite = sqlite;
  return _db;
}

/**
 * 获取 SQLite 原生连接（仅 SQLite 模式可用）
 */
export function getSqlite(): SqliteDatabase | null {
  return _sqlite;
}

/**
 * 获取 PostgreSQL 原生连接（仅 PostgreSQL 模式可用）
 */
export function getPostgres(): ReturnType<typeof import('postgres')> | null {
  return _sql;
}

/**
 * 检查当前使用的数据库类型
 */
export function getDatabaseType(): 'sqlite' | 'postgres' {
  return shouldUsePostgres() ? 'postgres' : 'sqlite';
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    console.log('[TeamClaw] SQLite connection closed');
  }
  
  if (_sql) {
    await _sql.end();
    _sql = null;
    console.log('[TeamClaw] PostgreSQL connection closed');
  }
  
  _db = null;
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{
  type: 'sqlite' | 'postgres';
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const type = getDatabaseType();
  
  if (type === 'postgres') {
    const { checkPostgresHealth } = await import('./adapters/postgres');
    if (!_sql) {
      return { type, healthy: false, error: 'Not connected' };
    }
    const result = await checkPostgresHealth(_sql);
    return { type, ...result };
  }
  
  // SQLite 健康检查
  if (!_sqlite) {
    return { type, healthy: false, error: 'Not connected' };
  }
  
  try {
    const start = Date.now();
    _sqlite.prepare('SELECT 1').get();
    const latency = Date.now() - start;
    return { type, healthy: true, latency };
  } catch (error) {
    return { 
      type, 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
